# Frontend Security Maintenance

Estado actual:
- `npm audit --json` debe devolver `0` vulnerabilidades activas
- Angular permanece en la rama `17.x`
- `@angular/cdk` se mantiene explícito junto con `@angular/material`

Rutina corta recomendada:

```bash
npm install
npm run security:check
npm start
```

Criterio esperado para `npm run security:check`:
- `low = 0`
- `moderate = 0`
- `high = 0`
- `critical = 0`

Notas:
- No hacer upgrades de major solo por mantenimiento rutinario si `npm audit` sigue en cero.
- Si reaparece una vulnerabilidad, revisar primero si se resuelve con patch/minor dentro de Angular 17 antes de considerar una migración mayor.
