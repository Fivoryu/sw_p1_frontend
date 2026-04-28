# AWS deployment

Este frontend Angular queda preparado para publicarse como sitio estatico en Amazon S3 y servirlo por CloudFront.

## Recursos AWS necesarios

- Un bucket S3 para hosting de artefactos
- Una distribucion CloudFront apuntando al bucket
- Un rol IAM para GitHub Actions con permisos sobre S3 y CloudFront

## Variables de GitHub Actions

Configura estas `Repository variables`:

- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

Configura estos `Repository secrets`:

- `AWS_ROLE_ARN`
- `API_BASE_URL`: URL publica del backend Spring Boot, por ejemplo `https://api.tudominio.com/api`
- `AI_SERVICE_BASE_URL`: URL publica del servicio FastAPI, por ejemplo `https://ai.tudominio.com`

## Flujo de despliegue

- Cada push a `main` ejecuta `.github/workflows/aws-deploy.yml`
- El workflow genera `src/assets/env.js` con las URLs de AWS
- Luego compila Angular, publica `dist/workflow-ui` en S3 e invalida CloudFront

## Nota para SPA

En CloudFront conviene mapear errores `403` y `404` a `/index.html` con codigo `200` para soportar rutas internas de Angular.
