# 🤖 GitHub Copilot Pipeline Failure Analyzer

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>

---

¡Hola developer 👋🏻! Esta es una extensión de Azure DevOps que analiza automáticamente los fallos de los pipelines usando [GitHub Copilot CLI](https://www.npmjs.com/package/@github/copilot) y proporciona análisis de causa raíz con IA y sugerencias accionables — directamente en el resumen de tu Pipeline.

<img src="failure.png" alt="Screenshot de Copilot Failure Analysis" width="100%" />

---

🌐 **Read this in English:** [README.md](README.md)

---

## 📑 Tabla de Contenidos
- [🤖 GitHub Copilot Pipeline Failure Analyzer](#-github-copilot-pipeline-failure-analyzer)
  - [📑 Tabla de Contenidos](#-tabla-de-contenidos)
  - [✨ Características](#-características)
  - [🛠️ Cómo Funciona](#️-cómo-funciona)
  - [📋 Requisitos Previos](#-requisitos-previos)
  - [🚀 Instalación](#-instalación)
    - [Paso 1: Instalar la Extensión](#paso-1-instalar-la-extensión)
    - [Paso 2: Crear la Conexión de Servicio](#paso-2-crear-la-conexión-de-servicio)
  - [⚙️ Configuración](#️-configuración)
    - [Opt-Out (Opcional)](#opt-out-opcional)
    - [Inputs de la Tarea](#inputs-de-la-tarea)
  - [👀 Qué Verás](#-qué-verás)
    - [🤖 Pestaña Copilot Failure Analysis](#-pestaña-copilot-failure-analysis)
    - [Pestaña Extensions](#pestaña-extensions)
  - [🏗️ Arquitectura](#️-arquitectura)
  - [🔧 Solución de Problemas](#-solución-de-problemas)
  - [🤝 Contribuir](#-contribuir)
    - [Setup de Desarrollo](#setup-de-desarrollo)
  - [📄 Licencia](#-licencia)
  - [🌐 Sígueme en Mis Redes Sociales](#-sígueme-en-mis-redes-sociales)

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

> 💡 **Pro Tip:** En lugar de crear una conexión de servicio en cada proyecto, puedes crearla una vez a nivel de **Organización** y compartirla con todos los proyectos. Ve a **Organization Settings** → **Service connections** → crea la conexión allí → luego usa **Security** para dar acceso a todos los proyectos. ¡Así solo tienes que gestionarla en un único lugar!

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

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🌐 Sígueme en Mis Redes Sociales

Si te ha gustado este proyecto, no olvides seguirme en mis redes sociales:

<div align="center">

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UC140iBrEZbOtvxWsJ-Tb0lQ?style=for-the-badge&logo=youtube&logoColor=white&color=red)](https://www.youtube.com/c/GiselaTorres?sub_confirmation=1)
[![GitHub followers](https://img.shields.io/github/followers/0GiS0?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0GiS0)
[![LinkedIn Follow](https://img.shields.io/badge/LinkedIn-Sígueme-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/giselatorresbuitrago/)
[![X Follow](https://img.shields.io/badge/X-Sígueme-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/0GiS0)

</div>
