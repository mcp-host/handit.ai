export const detectError = (data) => {
  if (
    data.error ||
    (typeof data.output === 'object' &&
      (data.output.error ||
        data?.dataValues?.error ||
        data?.dataValues?.output?.error) &&
      (data.output?.stack ||
        data?.dataValues?.output?.stack ||
        data?.stack ||
        data?.dataValues?.stack))
  ) {
    return true;
  }
  return false;
};

export const executeTrack = async (model, data, ModelLog) => {
  let externalId = data.externalId;

  const isGpt = typeof data.output === 'object' && 'choices' in data.output;
  if (isGpt) {
    const output = [data.output.choices[0].message.content];
    data.predicted = output;
  }
  if (!model.active) {
    return { error: 'Model is not active' };
  }

  data.modelId = model.id;

  let error = false;
  if (detectError(data)) {
    error = true;
  }
  try {
    // Find the agent node associated with this model
    const agentNode = await model.sequelize.models.AgentNode.findOne({
      where: { modelId: data.modelId, deletedAt: null }
    });
    // Start transaction to ensure data consistency

    let agentLogId = data.agentLogId || data.executionId;
    let agentLog = null;

    // If agentLogId is provided, try to find it
    if (agentLogId) {
      agentLog = await model.sequelize.models.AgentLog.findOne({
        where: {
          id: agentLogId,
          environment: data.environment || 'production',
        },
      });
      if (agentLog && agentLog.input === 'processing') {
        agentLog.input = data.input;
        await agentLog.save();
      }
    }

    if (!agentLog && externalId) {
      agentLog = await model.sequelize.models.AgentLog.findOne({
        where: {
          externalId,
        },
      });
    }

    if (!agentLog && agentNode) {
      agentLog = await model.sequelize.models.AgentLog.findOne({
        where: {
          agentId: agentNode.agentId,
          status: 'processing',
          environment: data.environment || 'production',
        },
        order: [['createdAt', 'DESC']],
        limit: 1,
      });
    }

    if (!agentLog) {
      agentLog = await model.sequelize.models.AgentLog.create({
        agentId: agentNode.agentId,
        input: data.input,
        status: error ? 'failed' : 'processing',
        environment: data.environment || 'production',
        metadata: {
          startedAt: new Date(),
          initialNodeId: agentNode.id,
        },
      });
      agentLogId = agentLog.id;
    }

    // Create the model log with the agent log association if available
    const modelLog = await ModelLog.create({
      ...data,
      parameters: {},
      metricProcessed: false,
      processed: false,
      environment: data.environment || 'production',
      agentLogId: agentLog?.dataValues?.id,
      status: error ? 'crash' : 'success',
    });

    return {
      modelLog,
      agentLogId: agentLog?.dataValues.id,
      modelLogId: modelLog.dataValues.id,
      executionId: agentLog?.dataValues.id,
    };
  } catch (error) {
    return { error: error.message };
  }
};

export const executeToolTrack = async (agentNode, data, agent) => {
  try {
    // Start transaction to ensure data consistency

      let externalId = data.externalId;
      let agentLogId = data.agentLogId || data.executionId;

      let agentLog = null;

      // If agentLogId is provided, try to find it
      if (agentLogId) {
        agentLog = await agentNode.sequelize.models.AgentLog.findOne({
          where: {
            id: agentLogId,
            environment: data.environment || 'production',
          },
        });

        if (agentLog && agentLog.input === 'processing') {
          agentLog.input = data.input;
          await agentLog.save();
        }
      }
      if (!agentLog && externalId) {
        agentLog = await agentNode.sequelize.models.AgentLog.findOne({
          where: {
            externalId,
          },
        });

        if (agentLog.input === 'processing') {
          agentLog.input = data.input;
          await agentLog.save();
        }
      }

      // If this is an initial node and no agentLogId provided, create new agent log
      if (!agentLog && externalId) {
        // Create new agent log for this initial node
        agentLog = await agentNode.sequelize.models.AgentLog.create(
          {
            agentId: agent.id,
            input: data.input,
            status: 'processing',
            environment: data.environment || 'production',
            metadata: {
              startedAt: new Date(),
              initialNodeId: agentNode.id,
            },
            externalId: externalId,
          },
        );
        agentLogId = agentLog.id;
      }

      if (!agentLog) {
        agentLog = await agentNode.sequelize.models.AgentLog.findOne({
          where: {
            agentId: agent.id,
            status: 'processing',
            environment: data.environment || 'production',
          },
          order: [['createdAt', 'DESC']],
          limit: 1,
        });
      }
      
      if (!agentLog) {
        await agentNode.sequelize.models.AgentLog.create({
          agentId: agent.id,
          input: data.input,
          status: 'processing',
          environment: data.environment || 'production',
          metadata: {
            startedAt: new Date(),
            initialNodeId: agentNode.id,
          },
        });
      }

      // Create the agent node log
      const agentNodeLog = await agentNode.sequelize.models.AgentNodeLog.create(
        {
          agentId: agent.id,
          agentNodeId: agentNode.id,
          input: data.input,
          output: data.output || {},
          environment: data.environment || 'production',
          operationType: agentNode.config?.operationType || 'tool_operation',
          status: data.error ? 'error' : 'success',
          duration: data.duration,
          metadata: {
            ...data.metadata,
            toolConfig: agentNode.config,
          },
          errorDetails: data.error ? { message: data.error } : null,
          parentLogId: agentLog?.dataValues?.id,
        },
      );
      const endTime = new Date();

      if (data.error && agentLog) {
        await agentLog.update(
          {
            status: 'failed',
            output: data.output,
            duration: endTime - new Date(agentLog.metadata.startedAt),
          },
        );
      }

      // If this is an end node and we have an agent log and autoStop is enabled, update it
      if (agentNode.endNode && agentLog && agent.autoStop) {
        let status = 'success';
        if (data.error) {
          status = 'failed';
        }
        await agentLog.update(
          {
            status,
            output: data.output,
            duration: endTime - new Date(agentLog.metadata.startedAt),
            metadata: {
              ...agentLog.metadata,
              endedAt: endTime,
              endNodeId: agentNode.id,
            },
          },
        );
      }

      return { agentNodeLog, agentLogId: agentLog?.dataValues.id, executionId: agentLog?.dataValues.id };

  } catch (error) {
    return { error: error.message };
  }
};
