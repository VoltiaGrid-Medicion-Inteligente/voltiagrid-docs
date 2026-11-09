# Customer portal: demo guide

This guide shows how to sign in to the portal as the demo customer and what each page shows. It is for the sprint 6 demo (US-69).

## How to sign in

1. Open the portal address the team shared with you.
2. In **Usuario**, type the demo customer code: `CU-MAC000002`.
3. In **Contraseña**, type the demo customer password. It is not in this document: the team reads it from AWS Secrets Manager, secret `voltiagrid-dev/app`, key `demo_customer_password`.

The session lives in memory only, so reloading the page closes it and asks for the credentials again. Do not reload the page during the demo.

If the form answers "Usuario o contraseña incorrectos.", check the username and the password. If it answers "No se pudo iniciar sesión. Inténtalo de nuevo.", the request did not reach the API: see the note at the end.

## What each page shows

- **Inicio:** links to the three customer sections and the button that closes the session.
- **Mi consumo:** total kWh and cost of the month, the change against the previous month, the estimated readings, the kWh per day and tariff band of the month, and the half-hour curve of the selected day. It only shows the data of the customer who signed in.
- **Mi contrato:** customer code, tariff (Estándar or Dinámica; "Sin contrato" when there is none), socioeconomic group and associated meters.
- **Mi red:** for each meter, the chain meter to transformer (code and capacity in kVA) to circuit.

## What must not happen

A customer must never see another customer's data. The API answers 403 when the consumption of another code is requested, and the portal only shows what the API returns for the open session.

## Note

The API allows the portal origin through CORS, and the list comes from the `CORS_ORIGINS` environment variable (default `http://localhost:5173`). From the cloud, the dev API needs `CORS_ORIGINS` to include the portal address; until that value is set, the browser blocks the sign-in request and the pages with data even when the page itself loads. In development the Vite proxy removes the problem, because the browser only talks to the portal origin.