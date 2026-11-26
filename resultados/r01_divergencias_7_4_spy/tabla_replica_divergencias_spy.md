# Réplica real de 7.4 — divergencias regulares RSI 14 en SPY diario (2005-01-01 → 2025-12-31)
Datos: `spy_yahoo_1d_2004_2025_sin_ajustar.csv`, SHA-256 `ba1b7e0165e8dc5e166d37bef9b085d28df27b68f71b860143ddbbd765e65df2` (ver MANIFEST_DATOS). Regímenes: alcista|vol_alta, alcista|vol_baja, bajista|vol_alta, bajista|vol_baja. Años en el bootstrap: 21.
| Dirección | N eventos | N base | Medida | Eventos | Base emparejada | Δ | IC 95 % (bootstrap por años) | p |
|---|---|---|---|---|---|---|---|---|
| alcista | 31 | 457 | Acierto de signo a 20 sesiones (%) | 74,194 | 67,055 | 7,138 | [-6,297; 17,551] | 0,2332 |
| alcista | 31 | 457 | Rendimiento firmado bruto a 20 sesiones (%) | 1,667 | 0,889 | 0,779 | [-1,050; 2,508] | 0,3698 |
| alcista | 31 | 457 | Ídem, neto de 5 pb ida y vuelta (%) | 1,617 | 0,839 | 0,779 | [-1,050; 2,508] | 0,3698 |
| alcista | 31 | 457 | Ídem, neto de 10 pb (%) | 1,567 | 0,789 | 0,779 | [-1,050; 2,508] | 0,3698 |
| bajista | 96 | 360 | Acierto de signo a 20 sesiones (%) | 30,208 | 33,247 | -3,039 | [-14,461; 8,248] | 0,6096 |
| bajista | 96 | 360 | Rendimiento firmado bruto a 20 sesiones (%) | -0,779 | -0,961 | 0,182 | [-0,740; 1,196] | 0,7156 |
| bajista | 96 | 360 | Ídem, neto de 5 pb ida y vuelta (%) | -0,829 | -1,011 | 0,182 | [-0,740; 1,196] | 0,7156 |
| bajista | 96 | 360 | Ídem, neto de 10 pb (%) | -0,879 | -1,061 | 0,182 | [-0,740; 1,196] | 0,7156 |

Rendimiento firmado: largo tras divergencia alcista, corto tras bajista. No es una regla de trading: es la comparación de una lectura contra su base.
