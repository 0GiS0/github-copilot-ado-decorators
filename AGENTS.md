Cada vez que tengas que lanzar un comando de GitHub CLI debes indicar `GH_PAGER=cat` para evitar que se abra un pager y se bloquee la ejecución del comando. Esto es especialmente importante en entornos donde no se puede interactuar con un pager, como en scripts o en la terminal de Azure DevOps.


Cuando se implemente una nueva funcionalidad hay que incrementar el número de versión del agente siguiendo el formato `MAJOR.MINOR.PATCH` en el archivo `azure-devops-extensions-dev.json` para asegurar que los cambios se reflejen correctamente en el entorno de Azure DevOps. Por ejemplo, si se añade una nueva función sin romper la compatibilidad, se debería incrementar el número de versión a `1.1.0`. Si se corrige un bug sin añadir nuevas funcionalidades, se incrementaría a `1.0.1`. Y si se introducen cambios que rompen la compatibilidad, se debería incrementar el número de versión a 


También quiero que cada vez que se pida una funcionalidad se siga GitHub Flow.