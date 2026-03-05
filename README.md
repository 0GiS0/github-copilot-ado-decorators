# 🤖 GitHub Copilot Pipeline Failure Analyzer

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>

---

An Azure DevOps extension that automatically analyzes pipeline failures using [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot) and provides AI-powered root cause analysis with actionable fix suggestions — directly in your Pipeline Run Summary.

<img src="failure.png" alt="Copilot Failure Analysis Screenshot" width="100%" />

---

## 🌐 Language / Idioma

- [English](#-english)
- [Español](#-español)

---

# 🇬🇧 English

## 📑 Table of Contents
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [What You'll See](#-what-youll-see)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Follow Me](#-follow-me-on-social-media)

## ✨ Features

- 🔍 **Automatic failure detection** — Analyzes pipeline failures without manual intervention
- 🤖 **AI-powered analysis** — Uses GitHub Copilot to understand error patterns and root causes
- 📝 **Actionable suggestions** — Provides specific fix recommendations, not just error descriptions
- 🎯 **Zero overhead on success** — The analysis step only runs when the pipeline fails
- 🔒 **Secure** — Uses your GitHub PAT via Azure DevOps service connections
- 📊 **Dedicated results tab** — View analysis in a custom "🤖 Copilot Failure Analysis" tab

## 🛠️ How It Works

```
Pipeline job fails
       │
       ▼
Decorator injects post-job step (condition: failed())
       │
       ▼
Reads GitHub PAT from service connection
       │
       ▼
Collects failed task logs via Azure DevOps REST API
       │
       ▼
Sends logs to GitHub Copilot CLI for analysis
       │
       ▼
Displays results in Pipeline Run Summary + custom tab
```

1. The decorator runs as a **post-job step** on every agent job
2. On failure, it fetches the timeline for the current build and identifies failed tasks
3. It collects the last N lines of each failed task's log (configurable, default 150)
4. A prompt with CI/CD context and logs is sent to `npx @github/copilot -sp`
5. Copilot's analysis appears in the **🤖 Copilot Failure Analysis** tab and **Extensions** tab
6. The analysis step **never fails your pipeline** — all errors are caught and reported as warnings

## 📋 Prerequisites

- **Azure DevOps organization** with admin permissions to install extensions
- **GitHub account** with an active **GitHub Copilot** license (Individual, Business, or Enterprise)
- **GitHub Personal Access Token (PAT)** from a Copilot-licensed account
- **Node.js** available on the build agent (Microsoft-hosted agents include it by default)

## 🚀 Installation

### Step 1: Install the Extension

> **Note:** Pipeline decorators can only be deployed as **private extensions**. This is a Microsoft platform constraint.

```bash
tfx extension publish \
  --manifest-globs azure-devops-extension.json \
  --share-with <your-ado-org-name> \
  --token <your-marketplace-pat>
```

Then go to **Organization Settings** → **Extensions** → **Shared** tab → click **Install**.

For full deployment steps, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Step 2: Create the Service Connection

1. Go to **Project Settings** → **Service connections**
2. Click **New service connection** → select **GitHub**
3. Configure:
   - **Connection name:** `GitHub Copilot CLI Decorator` *(must match exactly)*
   - **Personal Access Token:** Your GitHub PAT with Copilot license
4. Check **"Grant access permission to all pipelines"**
5. Click **Save**

> ⚠️ **Important:** The service connection name must be exactly `GitHub Copilot CLI Decorator`.

## ⚙️ Configuration

### Opt-Out (Optional)

To disable Copilot analysis for a specific pipeline:

```yaml
variables:
  COPILOT_ANALYSIS_DISABLED: 'true'
```

### Task Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `maxLogLines` | `150` | Maximum log lines to collect per failed step |
| `copilotNpxTimeout` | `120` | Timeout in seconds for Copilot CLI |

## 👀 What You'll See

When a pipeline fails, you'll find the analysis in:

### 🤖 Copilot Failure Analysis Tab

A dedicated tab with:
- **Root Cause** — Why the pipeline failed
- **Details** — Detailed error analysis
- **Suggested Fix** — Actionable steps to resolve the issue

### Extensions Tab

The same Markdown summary also appears in the legacy Extensions tab.

## 🏗️ Architecture

| Module | Purpose |
|--------|---------|
| `config.ts` | Reads task inputs and service connection credentials |
| `log-collector.ts` | Fetches failed task logs via Azure DevOps REST API |
| `prompt-builder.ts` | Constructs the analysis prompt with CI/CD context |
| `ai-analyzer.ts` | Invokes Copilot CLI via `npx @github/copilot -sp` |
| `output-formatter.ts` | Formats results and uploads the summary |
| `index.ts` | Orchestrates the full analysis flow |

For the complete architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🔧 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Service connection not configured | Create a GitHub service connection named exactly `GitHub Copilot CLI Decorator` |
| Copilot CLI timeout | Increase `copilotNpxTimeout` or check network connectivity |
| npx command not found | Ensure Node.js is installed on the agent |
| No failed tasks found | Check `System.AccessToken` has build read permissions |

See [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting) for more details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and run tests (`npm test`)
4. Commit (`git commit -m 'feat: add my feature'`)
5. Push (`git push origin feature/my-feature`)
6. Open a Pull Request

### Development Setup

```bash
npm install       # Install dependencies
npm run build     # Build
npm test          # Run tests
npm run package-extension:dev  # Package dev extension
```

---

# 🇪🇸 Español

## 📑 Tabla de Contenidos
- [Características](#-características)
- [Cómo Funciona](#-cómo-funciona)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación-1)
- [Configuración](#-configuración)
- [Qué Verás](#-qué-verás)
- [Arquitectura](#-arquitectura)
- [Solución de Problemas](#-solución-de-problemas)
- [Contribuir](#-contribuir)
- [Sígueme](#-sígueme-en-mis-redes-sociales)

## ✨ Características

- 🔍 **Detección automática de fallos** — Analiza los fallos del pipeline sin intervención manual
- 🤖 **Análisis con IA** — Usa GitHub Copilot para entender patrones de error y causas raíz
- 📝 **Sugerencias accionables** — Proporciona recomendaciones específicas, no solo descripciones de errores
- 🎯 **Cero sobrecarga en éxito** — El paso de análisis solo se ejecuta cuando el pipeline falla
- 🔒 **Seguro** — Usa tu PAT de GitHub mediante conexiones de servicio de Azure DevOps
- 📊 **Tab de resultados dedicado** — Ve el análisis en una pestaña personalizada "🤖 Copilot Failure Analysis"

## 🛠️ Cómo Funciona

```
El job del pipeline falla
       │
       ▼
El decorator inyecta un paso post-job (condición: failed())
       │
       ▼
Lee el PAT de GitHub de la conexión de servicio
       │
       ▼
Recolecta logs de tareas fallidas via API REST de Azure DevOps
       │
       ▼
Envía los logs a GitHub Copilot CLI para análisis
       │
       ▼
Muestra resultados en el Resumen del Pipeline + pestaña personalizada
```

1. El decorator se ejecuta como **paso post-job** en cada job de agente
2. En caso de fallo, obtiene la línea temporal del build e identifica tareas fallidas
3. Recolecta las últimas N líneas del log de cada tarea fallida (configurable, por defecto 150)
4. Un prompt con contexto CI/CD y logs se envía a `npx @github/copilot -sp`
5. El análisis de Copilot aparece en la pestaña **🤖 Copilot Failure Analysis** y **Extensions**
6. El paso de análisis **nunca falla tu pipeline** — todos los errores se capturan como advertencias

## 📋 Requisitos Previos

- **Organización de Azure DevOps** con permisos de admin para instalar extensiones
- **Cuenta de GitHub** con licencia activa de **GitHub Copilot** (Individual, Business o Enterprise)
- **Personal Access Token (PAT) de GitHub** de una cuenta con licencia de Copilot
- **Node.js** disponible en el agente de build (los agentes de Microsoft lo incluyen por defecto)

## 🚀 Instalación

### Paso 1: Instalar la Extensión

> **Nota:** Los pipeline decorators solo pueden desplegarse como **extensiones privadas**. Es una restricción de la plataforma de Microsoft.

```bash
tfx extension publish \
  --manifest-globs azure-devops-extension.json \
  --share-with <tu-org-de-ado> \
  --token <tu-pat-del-marketplace>
```

Luego ve a **Organization Settings** → **Extensions** → pestaña **Shared** → clic en **Install**.

Para pasos completos de despliegue, ver [DEPLOYMENT.md](DEPLOYMENT.md).

### Paso 2: Crear la Conexión de Servicio

1. Ve a **Project Settings** → **Service connections**
2. Clic en **New service connection** → selecciona **GitHub**
3. Configura:
   - **Connection name:** `GitHub Copilot CLI Decorator` *(debe coincidir exactamente)*
   - **Personal Access Token:** Tu PAT de GitHub con licencia de Copilot
4. Marca **"Grant access permission to all pipelines"**
5. Clic en **Save**

> ⚠️ **Importante:** El nombre de la conexión de servicio debe ser exactamente `GitHub Copilot CLI Decorator`.

## ⚙️ Configuración

### Opt-Out (Opcional)

Para deshabilitar el análisis de Copilot en un pipeline específico:

```yaml
variables:
  COPILOT_ANALYSIS_DISABLED: 'true'
```

### Inputs de la Tarea

| Input | Por defecto | Descripción |
|-------|-------------|-------------|
| `maxLogLines` | `150` | Líneas máximas de log a recolectar por paso fallido |
| `copilotNpxTimeout` | `120` | Timeout en segundos para Copilot CLI |

## 👀 Qué Verás

Cuando un pipeline falla, encontrarás el análisis en:

### 🤖 Pestaña Copilot Failure Analysis

Una pestaña dedicada con:
- **Root Cause** — Por qué falló el pipeline
- **Details** — Análisis detallado del error
- **Suggested Fix** — Pasos accionables para resolver el problema

### Pestaña Extensions

El mismo resumen en Markdown también aparece en la pestaña legacy Extensions.

## 🏗️ Arquitectura

| Módulo | Propósito |
|--------|-----------|
| `config.ts` | Lee inputs de la tarea y credenciales de la conexión de servicio |
| `log-collector.ts` | Obtiene logs de tareas fallidas via API REST de Azure DevOps |
| `prompt-builder.ts` | Construye el prompt de análisis con contexto CI/CD |
| `ai-analyzer.ts` | Invoca Copilot CLI via `npx @github/copilot -sp` |
| `output-formatter.ts` | Formatea resultados y sube el resumen |
| `index.ts` | Orquesta el flujo completo de análisis |

Para la arquitectura completa, ver [ARCHITECTURE.md](ARCHITECTURE.md).

## 🔧 Solución de Problemas

| Síntoma | Solución |
|---------|----------|
| Conexión de servicio no configurada | Crea una conexión de servicio GitHub llamada exactamente `GitHub Copilot CLI Decorator` |
| Timeout de Copilot CLI | Aumenta `copilotNpxTimeout` o verifica la conectividad de red |
| Comando npx no encontrado | Asegúrate de que Node.js está instalado en el agente |
| No se encontraron tareas fallidas | Verifica que `System.AccessToken` tiene permisos de lectura del build |

Ver [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting) para más detalles.

## 🤝 Contribuir

1. Haz fork del repositorio
2. Crea una rama de feature (`git checkout -b feature/mi-feature`)
3. Haz tus cambios y ejecuta tests (`npm test`)
4. Commit (`git commit -m 'feat: añade mi feature'`)
5. Push (`git push origin feature/mi-feature`)
6. Abre un Pull Request

### Setup de Desarrollo

```bash
npm install       # Instalar dependencias
npm run build     # Compilar
npm test          # Ejecutar tests
npm run package-extension:dev  # Empaquetar extensión dev
```

---

## 📄 License / Licencia

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🌐 Follow Me on Social Media

If you liked this project, don't forget to follow me on my social networks:

Si te ha gustado este proyecto, no olvides seguirme en mis redes sociales:

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>
