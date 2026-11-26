# motor/

- `ta/`: el motor de cálculo del libro, el paquete `@miggy/ta` (TypeScript, sin dependencias). Las cifras impresas se generaron con este código. El código se publica sin cambios; solo se han retirado comentarios internos (rutas de trabajo y titular) y el archivo de pruebas internas (`ta.test.ts`).
- `exportar_banco.mts`: exporta a JSON los tres bancos simulados del libro.
- `experimento_14_2.mts`: registro completo del experimento de 464 variantes, hecho con `backtest`, `metricas` y `optimizar` del motor.
- `matriz_7_3.mts`: la matriz de 18 osciladores (153 parejas), hecha con `matrizOsciladores` del motor.
- `martillo_3_3.mts`: recuento del martillo en el banco general (umbral `mechaLarga`), hecho con `sensibilidad` del motor.

Se ejecutan con `node --experimental-strip-types` (Node ≥ 22.6). No hay que instalar nada.
