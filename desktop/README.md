# PharmaERP POS Desktop

Application Windows installable pour les postes de caisse PharmaERP.

## Architecture V1

- Electron charge le POS production existant : `https://pharma-erp-saas-five.vercel.app/pos`.
- Le backend NestJS, Supabase et les donnees metier restent dans le cloud.
- IndexedDB, service worker, cache PWA, moteur offline, workstation, allocations, queue et sync restent ceux du frontend actuel.
- Les donnees locales sont stockees dans le profil Electron Windows `PharmaERP POS`.
- Le Print Agent local est embarque comme ressource et lance par l'application quand elle demarre.

## Installation client

Le client installe uniquement `PharmaERP-POS-Setup.exe`.

Le client n'a pas besoin de Git, Node.js, npm, PowerShell manuel, Codex ou code source.

## Mise a jour

V1 utilise l'installateur NSIS. Les donnees locales ne sont pas supprimees a la desinstallation par defaut (`deleteAppDataOnUninstall: false`).

Prochaine etape recommandee : ajouter `electron-updater` avec un canal GitHub Releases ou Vercel/S3 prive signe pour diffuser automatiquement les nouvelles versions.
