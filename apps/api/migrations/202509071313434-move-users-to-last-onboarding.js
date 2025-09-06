'use strict';

export const up = async (queryInterface, Sequelize) => {
  const { Op } = Sequelize;

  // Find users that have onboarding_current_tour but it's different from 'welcome-concept-walkthrough'
  const users = await queryInterface.sequelize.query(`
    SELECT id, company_id, onboarding_current_tour
    FROM "Users" 
    WHERE onboarding_current_tour IS NOT NULL 
    AND onboarding_current_tour != 'welcome-concept-walkthrough'
  `, {
    type: queryInterface.sequelize.QueryTypes.SELECT
  });

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    let newTour = null;

    try {
      // Check if user has agents
      const agents = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as agent_count
        FROM "Agents" 
        WHERE company_id = :companyId
      `, {
        replacements: { companyId: user.company_id },
        type: queryInterface.sequelize.QueryTypes.SELECT
      });

      const hasAgents = agents[0].agent_count > 0;

      if (hasAgents) {
        // Check for optimizations using the same logic as checkUserOptimizations
        const modelGroups = await queryInterface.sequelize.query(`
          SELECT id FROM "ModelGroups" WHERE company_id = :companyId
        `, {
          replacements: { companyId: user.company_id },
          type: queryInterface.sequelize.QueryTypes.SELECT
        });

        const modelIds = modelGroups.map(group => group.id);

        if (modelIds.length > 0) {
          // Find optimized models
          const optimizedModels = await queryInterface.sequelize.query(`
            SELECT id FROM "Models" 
            WHERE is_optimized = true 
            AND model_group_id IN (:modelIds)
          `, {
            replacements: { modelIds },
            type: queryInterface.sequelize.QueryTypes.SELECT
          });

          if (optimizedModels.length > 0) {
            const optimizedModelIds = optimizedModels.map(model => model.id);

            // Check if any optimized models have versions
            const modelVersions = await queryInterface.sequelize.query(`
              SELECT COUNT(*) as version_count
              FROM "ModelVersions" 
              WHERE model_id IN (:optimizedModelIds)
            `, {
              replacements: { optimizedModelIds },
              type: queryInterface.sequelize.QueryTypes.SELECT
            });

            const hasOptimizations = modelVersions[0].version_count > 0;

            if (hasOptimizations) {
              newTour = 'first-optimization-celebration';
            } else {
              newTour = 'first-trace-tracing-evaluation';
            }
          } else {
            newTour = 'first-trace-tracing-evaluation';
          }
        } else {
          newTour = 'first-trace-tracing-evaluation';
        }
      } else {
        // No agents, go to setup
        newTour = 'autonomous-engineer-setup';
      }

      // Update the user's onboarding tour
      if (newTour) {
        await queryInterface.sequelize.query(`
          UPDATE "Users" 
          SET onboarding_current_tour = :newTour 
          WHERE id = :userId
        `, {
          replacements: { 
            newTour, 
            userId: user.id 
          }
        });

        console.log(`Updated user ${user.id} from '${user.onboarding_current_tour}' to '${newTour}'`);
      }

    } catch (error) {
      console.error(`Error processing user ${user.id}:`, error);
    }
  }

  console.log('Migration completed');
};

export const down = async (queryInterface, Sequelize) => {
  // This migration is not easily reversible as we don't store the original tour values
  console.log('This migration cannot be reversed as original tour values were not preserved');
};