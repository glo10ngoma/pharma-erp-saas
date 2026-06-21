ERP PHARMACEUTIQUE SaaS V2 - SCHEMA FINAL V3

Fichier principal :
erp_pharmaceutique_saas_v2_schema_final_v3.sql

Contenu :
1. Schéma principal V1.1
2. Add-on V2 : inventaires, transferts, notifications, pièces jointes
3. Add-on SaaS Multi-Tenant
4. Add-on Finance / Caisse / Reporting BI

Conseils d'exécution :
- Exécuter sur une base PostgreSQL/Supabase vide.
- Vérifier que l'extension uuid-ossp est autorisée.
- Après exécution, créer un tenant pilote, un site, un utilisateur admin et importer le catalogue articles.
- Avant production, tester les règles RLS, les permissions et les workflows achat/vente/stock.
