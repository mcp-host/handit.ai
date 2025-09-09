
<p align="center">
  <!-- shows in LIGHT mode only -->
  <img src="./apps/dashboard/public/assets/overview/handit-small-3.png#gh-light-mode-only" width="400" style="object-fit: cover; object-position: center;" alt="Handit logo" />
  <!-- shows in DARK mode only -->
  <img src="./apps/dashboard/public/assets/overview/handit-small-1.png#gh-dark-mode-only" width="400" style="object-fit: cover; object-position: center;" alt="Handit logo (dark)" />
</p>

<p align="center">
  <strong>🔥 The Autonomous Engineer That Fixes Your AI 24/7 🔥</strong>
</p>

<p align="center">
  Handit catches failures, writes fixes, tests them, and ships PRs, automatically. Like having an on-call engineer dedicated to your AI, except it works 24/7.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@handit.ai/node">
    <img src="https://img.shields.io/npm/v/@handit.ai/node?style=flat&logo=npm&logoColor=white&color=CB3837&labelColor=000000" alt="npm version">
  </a>
  <a href="https://pypi.org/project/handit-sdk/">
    <img src="https://img.shields.io/pypi/v/handit-sdk?style=flat&logo=pypi&logoColor=white&color=3776AB&labelColor=000000" alt="pypi version">
  </a>
  <a href="https://github.com/handit-ai/handit.ai/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat&logo=opensourceinitiative&logoColor=white&labelColor=000000" alt="license">
  </a>
  <a href="https://github.com/handit-ai/handit.ai">
    <img src="https://img.shields.io/github/stars/handit-ai/handit.ai?style=flat&logo=github&logoColor=white&color=yellow&labelColor=000000" alt="GitHub stars">
  </a>
  <a href="https://discord.com/invite/XCVWYCFen6" target="_blank">
    <img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=flat&logo=discord&logoColor=white&labelColor=000000" alt="Discord">
  </a>
</p>

<p align="center">
  <a href="https://docs.handit.ai/quickstart">🚀 Quick Start</a> •
  <a href="https://docs.handit.ai/">📋 Core Features</a> •
  <a href="https://docs.handit.ai/">📚 Docs</a> •
  <a href="https://calendly.com/cristhian-handit/30min">📅 Schedule a Call</a>
</p>

---

## 🎯 What is handit.ai?

**handit.ai solves AI reliability.**

Modern AI applications are fragile – they hallucinate, break schemas, leak PII, and fail silently. When your AI fails at 2am, customers complain, and you're debugging blind. Did the model change? Is a tool broken? Is there a logic error? Without visibility, you're playing whack-a-mole with quality issues.

**handit.ai is your autonomous engineer** that monitors your AI 24/7, detects issues, generates fixes, tests them against real data, and ships them as pull requests—all automatically.

Write JavaScript, TypeScript, Python, and more. What used to take manual debugging and firefighting now happens automatically with handit.ai.

![handit.ai autonomous engineer workflow](https://handit.ai/assets/workflow-diagram.png)

---

---

## 🚀 Quick Start

Get your autonomous engineer up and running in under 5 minutes:

### 1. Install the handit CLI

```bash
npm install -g @handit.ai/cli
```

### 2. Start the Setup Process

Navigate to your AI project directory and run:

```bash
handit-cli setup
```

The CLI will guide you through connecting your autonomous engineer:

- 🔧 **Connect your handit.ai account**
- 📱 **Install the handit SDK** in your project
- 🔑 **Configure your API key** for monitoring
- 🧠 **Connect evaluation models** (OpenAI, Together AI, etc.)
- 🔗 **Connect your GitHub repository** for automated PRs

### 3. Verify Your Setup

✅ **Check your dashboard**: Go to [dashboard.handit.ai](https://dashboard.handit.ai) - you should see:
- Tracing data flowing in real-time
- Quality scores for evaluated interactions
- Agent Performance showing baseline metrics

✅ **Confirm GitHub integration**: Check your repository - you should see:
- handit app installed in repository settings
- Ready for PRs - your autonomous engineer can now create pull requests

**That's it!** Your autonomous engineer is now monitoring your AI, evaluating quality, and ready to create pull requests with fixes whenever issues are detected.

---

## 🎯 How It Works

### 🔍 **Detect** - Real-Time Failure Detection
**On-Call 24/7**: Monitors every request, catches failures in real-time before customers complain.

- Hallucinations and incorrect responses
- Schema breaks and validation errors  
- PII leaks and security issues
- Performance degradation and timeouts

### 🧠 **Diagnose & Fix** - Automated Fix Generation
**Insights**: Analyzes root causes, generates fixes and tests solutions on actual failure cases in production.

- Prompt improvements and optimizations
- Configuration changes and guardrails
- Code fixes for logic errors
- Model parameter adjustments

### 📝 **Ship** - GitHub-Native Deployment
**Opens PRs with proven fixes**: You review and merge, or auto-deploy with guardrails.

- Tested fixes with real performance data
- Detailed explanations of changes
- A/B testing results and metrics
- Rollback capabilities

---

## 🎯 Examples

### 🏆 **[Unstructured to Structured](https://github.com/Handit-AI/handit-examples/tree/main/examples/unstructured-to-structured)**

Self-improving AI agent that automatically converts messy, unstructured documents into clean, structured data and CSV tables. Perfect for processing invoices, purchase orders, contracts, medical reports, and any other document types. But here's the kicker - **it actually gets better at its job over time**.

**[Source Code →](https://github.com/Handit-AI/handit-examples/tree/main/examples/unstructured-to-structured)**

> ![Unstructured to Structured in action](https://raw.githubusercontent.com/Handit-AI/handit-examples/main/examples/unstructured-to-structured/assets/cover/cover.gif)

**Key Features:** ✨
- **Schema Inference** 🔍: AI analyzes documents and creates optimal JSON structure
- **Data Extraction** 📊: Maps document fields to schema with confidence scoring
- **CSV Generation** 📋: Automatically creates organized tables for data visualization
- **Multimodal Support** 🖼️: Handles images, PDFs, and text files
- **Session Management** 🗂️: Isolated processing for different document batches
- **Self-improvement** 🧠: Handit observes every agent interaction, and if a failure is detected, it automatically fixes it

**Technologies:** 🛠️ Python, LangGraph, LangChain, OpenAI, FastAPI, Pandas, Handit.ai

---

## 🌐 Language Support

Write your AI agents in your preferred language:

| Language       | Status        | SDK Package           |
| -------------- | ------------- | --------------------- |
| **Python**     | ✅ Stable      | [`handit-sdk>=1.16.0`](https://pypi.org/project/handit-sdk/)  |
| **JavaScript** | ✅ Stable      | [`@handit.ai/node`](https://www.npmjs.com/package/@handit.ai/node)     |
| **TypeScript** | ✅ Stable      | [`@handit.ai/node`](https://www.npmjs.com/package/@handit.ai/node)     |
| **Go**         | ✅ Available | HTTP API integration          |
| **Any Stack/Framework** | ✅ Available | HTTP API integration (n8n, Zapier, etc.) |
| **Java, C#, Ruby, PHP** | ✅ Available | REST API integration |
| **LangChain & LangGraph** | ✅ Available | Python/JS SDK |
| **LlamaIndex, AutoGen** | ✅ Available | Python/JS SDK + HTTP API |
| **CrewAI, Swarm** | ✅ Available | Python SDK + HTTP API |

---

## 🎯 Real Results

See how teams eliminated their AI firefighting with handit.ai:

### **Aspe.ai**
ASPE.ai was running a high-stakes agent that was silently failing every time. Within 48 hours of connecting handit, the system identified the issue, tested fixes, and deployed the new prompts.

- **+62.3%** Accuracy improvement
- **+36%** Response relevance  
- **+97.8%** Success rate

### **XBuild**
XBuild's AI was suffering from prompt drift that tanked performance across key models. handit stepped in, ran automatic A/B tests, and deployed the top-performing versions.

- **+34.6%** Accuracy improvement
- **+19.1%** Success rate
- **+6600** Automatic evaluations

---

## ⚡ Features: Everything Your Autonomous Engineer Does

Handit isn't just another tool—it's an autonomous team member handling your AI reliability 24/7.

### 🔍 Real-Time Failure Detection
**Never Miss a Failure:** Catches hallucinations, schema breaks, PII leaks, and performance issues as they happen. No more finding out from angry customers.

### 🤖 Automated Fix Generation  
**Writes Production-Ready Code:** Generates prompt improvements, config changes, and guardrails. Tests each fix against real failures before shipping.

### 📊 A/B Testing & Validation
**Data-Driven Decisions:** Every fix is tested on live data. See exact accuracy improvements, latency impacts, and success rates before deploying.

### 🧠 Fix Registry & Memory
**Gets Smarter Over Time:** Remembers every failure and successful fix. Instantly applies proven solutions to recurring issues. Your engineer's growing expertise.

---

## 🎯 How We Do It: Your Autonomous Engineer in Action

**From failure to fix in production—fully automated, fully auditable, fully open-source.**

### 🔍 Detect
**On-Call 24/7**  
Monitors every request, catches failures in real-time before customers complain.

### 🧠 Diagnose & Fix  
**Insights**  
Analyzes root causes, generates fixes and tests solutions on actual failure cases in production.

### 🚀 Ship
**GitHub-Native**  
Opens PRs with proven fixes. You review and merge, or auto-deploy with guardrails.

---

## 📈 Effectiveness: Real Engineers. Real Results.

See how teams eliminated their AI firefighting with Handit.

### 🏢 ASPE.ai
ASPE.ai was running a high-stakes agent that was silently failing every time. Within 48 hours of connecting Handit, the system identified the issue, tested fixes, and deployed the new prompts.

- **+62.3%** Accuracy
- **+36%** Response relevance  
- **+97.8%** Success rate

### 🏢 XBuild
XBuild's AI was suffering from prompt drift that tanked performance across key models. Handit stepped in, ran automatic A/B tests, and deployed the top-performing versions.

- **+34.6%** Accuracy
- **+19.1%** Success rate
- **+6600** Automatic evaluations

---

## 🛠️ Advanced: Manual Setup

**Advanced users only.** If you need custom control over your autonomous engineer setup, you can manually add monitoring code instead of using the CLI.

**When to use manual setup:**
- Custom deployment environments
- Complex agent architectures  
- Need granular control over monitoring

**Quick manual setup:**
- [Manual Setup Guide](https://docs.handit.ai/manual-setup) - Add decorators yourself
- [Advanced Setup](https://docs.handit.ai/advanced-setup) - Node-by-node monitoring

### Troubleshooting

❌ **CLI command not found?**
- **Solution:** Install Node.js first: `node --version` (should show v16+)
- If still failing: `npm uninstall -g @handit.ai/cli && npm install -g @handit.ai/cli`

❌ **"Authentication failed" during setup?**
- **Solution:** Check your Handit.ai account credentials at [dashboard.handit.ai](https://dashboard.handit.ai)
- If still failing: Try logging out and back in to your Handit account

❌ **No traces appearing in dashboard?**
- **Solution:** Run `handit-cli setup` again to regenerate configuration
- Check: Your generated code is actually being executed (not just imported)
- Verify: API key was set correctly: `echo $HANDIT_API_KEY`

❌ **Evaluations not running?**
- **Solution:** Re-run `handit-cli evaluators-setup` to verify model connections
- Check: Model tokens have sufficient credits in your provider dashboard
- Verify: Your AI is receiving traffic (evaluations only run on active agents)

❌ **GitHub app installation failed?**
- **Solution:** Ensure you have admin access to the repository
- Try: `handit-cli github` again to reinstall the app
- Check: Repository permissions in GitHub Settings → Applications

**Need Help?**
- **Community:** [Discord](https://discord.com/invite/XCVWYCFen6) for real-time help
- **Support:** [Contact Us](https://calendly.com/cristhian-handit/30min) for technical issues
- **Advanced:** [Manual Setup](https://docs.handit.ai/manual-setup) for custom configurations

---
## 🎯 Examples

### 🏆 **[ChessArena.ai](https://chessarena.ai)** - Full-Featured Production App
A complete chess platform benchmarking LLM performance with real-time evaluation.

**[Live Website →](https://chessarena.ai)** | **[Source Code →](https://github.com/handit-ai/chessarena)**

Built from scratch to production deployment, featuring:

🔐 **Authentication & user management**  
🤖 **Multi-agent LLM evaluation** (OpenAI, Claude, Gemini, Grok)  
🐍 **Python engine integration** (Stockfish chess evaluation)  
📊 **Real-time streaming** with live move updates and scoring  
🎨 **Modern React UI** with interactive chess boards  
🔄 **Event-driven workflows** connecting TypeScript APIs to Python processors  
📈 **Live leaderboards** with move-by-move quality scoring  
🚀 **Production deployment** on Handit Cloud  

### 📚 More Examples

| Example | Description |
|---------|-------------|
| **AI Research Agent** | Web research with iterative analysis |
| **Streaming Chatbot** | Real-time AI responses |
| **Gmail Automation** | Smart email processing |
| **GitHub PR Manager** | Automated PR workflows |
| **Finance Agent** | Real-time market analysis |

**Features demonstrated:** Multi-language workflows • Real-time streaming • AI integration • Production deployment

**[View all 20+ examples →](https://github.com/handit-ai/handit-examples)**

---

## 🌐 Language Support

Write your AI agents in your preferred language:

| Language       | Status        | SDK Package           |
| -------------- | ------------- | --------------------- |
| **Python**     | ✅ Stable      | [`handit-sdk>=1.16.0`](https://pypi.org/project/handit-sdk/)  |
| **JavaScript** | ✅ Stable      | [`@handit.ai/node`](https://www.npmjs.com/package/@handit.ai/node)     |
| **TypeScript** | ✅ Stable      | [`@handit.ai/node`](https://www.npmjs.com/package/@handit.ai/node)     |
| **Go**         | ✅ Available | HTTP API integration          |
| **Any Stack/Framework** | ✅ Available | HTTP API integration (n8n, Zapier, etc.) |
| **Java, C#, Ruby, PHP** | ✅ Available | REST API integration |
| **LangChain & LangGraph** | ✅ Available | Python/JS SDK |
| **LlamaIndex, AutoGen** | ✅ Available | Python/JS SDK + HTTP API |
| **CrewAI, Swarm** | ✅ Available | Python SDK + HTTP API |

---

## 🏆 Trusted by Teams Who Ship Production AI

**Open source because you need to trust what pushes to prod.**

![Trusted by Teams](./apps/dashboard/public/assets/overview/trusted-by.png)

**Stop Being Your AI's On-Call Engineer**  
Let Handit handle the 2am failures while you focus on building features. Open source. GitHub-native. Starts working in minutes!

---

### 💬 **Get Help**
- **📋 Questions**: Use our [Discord community](https://discord.com/invite/XCVWYCFen6)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/handit-ai/handit.ai/issues)
- **📖 Documentation**: [Official Docs](https://docs.handit.ai)
- **📅 Schedule a Call**: [Book a Demo](https://calendly.com/cristhian-handit/30min)

### 🤝 **Contributing**

#### 🚀 Roadmap

We're building Handit in the open, and we'd love for you to be a part of the journey.

| Week | Focus                                               | Status         |
|------|------------------------------------------------------|----------------|
| 1    | Backend foundation + infrastructure                 | ✔️ Done |
| 2    | Prompt versioning              | ✔️ Done |
| 3    | Auto-evaluation + insight generation                | ✔️ Done |
| 4    | Deployment setup + UI + public release              | ✔️ Done |

We welcome contributions! Whether it's:
- 🐛 Bug fixes and improvements
- ✨ New features
- 📚 Documentation and examples
- 🌍 Language support additions
- 🎨 Dashboard UI enhancements

---

## 👥 Contributors

Thanks to everyone helping bring Handit to life:

<a href="https://github.com/handit-ai/handit.ai/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=handit-ai/handit.ai" />
</a>


> Want to appear here? Star the repo, follow along, and make your first PR 🙌

---
<div align="center">

**🌟 Ready to auto-improve your AI?**

[🚀 **Get Started Now**](https://www.handit.ai/) • [📖 **Read the Docs**](https://docs.handit.ai/quickstart) • [💬 **Join Discord**](https://discord.com/invite/XCVWYCFen6) • [📅 **Schedule a Call**](https://calendly.com/cristhian-handit/30min)

</div>

---
<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=handit-ai/handit.ai&type=Date)](https://www.star-history.com/#handit-ai/handit.ai&Date)

<sub>Built with ❤️ by the Handit team • **Star us if you find Handit useful!** ⭐</sub>

</div>

---

## 🚧 Roadmap

We have a public roadmap for handit.ai. You can view it [here](https://github.com/handit-ai/autonom/projects/1).

Feel free to add comments to the issues, or create a new issue if you have a feature request.

| Feature | Status | Link | Description |
|---------|--------|------|-------------|
| Advanced Prompt Optimization | Planned | [#485](https://github.com/handit-ai/autonom/issues/485) | Multi-model prompt optimization |
| Custom Evaluation Metrics | Planned | [#495](https://github.com/handit-ai/autonom/issues/495) | User-defined evaluation criteria |
| Real-time Dashboard | Planned | [#497](https://github.com/handit-ai/autonom/issues/497) | Live monitoring interface |
| Auto-deployment | Planned | [#476](https://github.com/handit-ai/autonom/issues/476) | Automated deployment with guardrails |
| Multi-agent Support | Planned | [#477](https://github.com/handit-ai/autonom/issues/477) | Complex agent orchestration |
| Custom Integrations | Planned | [#480](https://github.com/handit-ai/autonom/issues/480) | Third-party tool integrations |

---

## 📚 Resources

- 📖 **[Documentation](https://docs.handit.ai)** - Complete guides and API reference
- 💬 **[Discord](https://discord.gg/handit-ai)** - Community support and discussions  
- 🐛 **[GitHub Issues](https://github.com/handit-ai/autonom/issues)** - Bug reports and feature requests
- 🗺️ **[Roadmap](https://github.com/handit-ai/autonom/projects/1)** - Upcoming features and progress
- 🎥 **[Demo](https://handit.ai/demo)** - See handit in action

---

## 🤝 Contributing

We welcome contributions! Check our [Contributing Guide](CONTRIBUTING.md) to get started.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/handit-ai/autonom.git
cd autonom

# Install dependencies
npm install

# Start development environment
npm run dev
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Need Help?

- **Community**: [Discord](https://discord.gg/handit-ai) for real-time help
- **Support**: [Contact Us](https://handit.ai/contact) for technical issues
- **Documentation**: [docs.handit.ai](https://docs.handit.ai) for comprehensive guides

---

<div align="center">

**Stop Being Your AI's On-Call Engineer**

Let handit.ai handle the 2am failures while you focus on building features.

[**Get Started Free**](https://dashboard.handit.ai) • [**View on GitHub**](https://github.com/handit-ai/autonom) • [**Join Discord**](https://discord.gg/handit-ai)

*Open source. GitHub-native. Starts working in minutes.*

</div>


