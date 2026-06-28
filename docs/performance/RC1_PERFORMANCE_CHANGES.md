# RC1 Performance Changes

Date: 28/06/2026

## Changements realises

### 1. Code splitting par routes lourdes

`frontend/src/App.tsx` utilise maintenant `React.lazy` et `Suspense` pour charger a la demande les pages lourdes:

- Dashboard BI;
- Rapports;
- Analyses;
- Notifications;
- Assurance V2;
- Finance;
- Administration.

Les parcours critiques restent en import direct:

- POS;
- achats et nouvel achat;
- articles;
- referentiel;
- lots;
- stocks;
- inventaires;
- transferts;
- caisse;
- ventes.

Cette decision evite de ralentir la caisse et les workflows operationnels.

### 2. Recharts isole du bundle initial

Recharts est maintenant dans un chunk separe charge uniquement par les pages graphiques:

- Dashboard BI;
- Analyses.

Un vendeur qui arrive sur `/pos` ne charge plus Recharts dans le bundle initial.

### 3. Aucun changement API ou metier

Aucune route backend, regle metier, permission, seed ou schema n'a ete modifie.

Les appels API existants restent identiques. L'optimisation vient du fait que les pages non ouvertes ne montent plus leurs composants et ne chargent plus leurs dependances.

## Mesures avant / apres

### Avant

| Asset | Taille | Gzip |
| --- | ---: | ---: |
| CSS principal | 53.07 kB | 9.41 kB |
| JS initial | 1,072.83 kB | 281.70 kB |

### Apres

| Asset | Taille | Gzip |
| --- | ---: | ---: |
| CSS principal | 53.07 kB | 9.41 kB |
| JS initial | 539.95 kB | 144.26 kB |
| Recharts / charts lazy chunk | 411.56 kB | 111.04 kB |
| Dashboard BI lazy chunk | 13.19 kB | 4.26 kB |
| Analytics lazy chunk | 37.23 kB | 10.54 kB |
| Reports lazy chunk | 12.60 kB | 4.10 kB |
| Insurance V2 lazy chunk | 18.67 kB | 4.98 kB |
| Notifications lazy chunk | 6.46 kB | 2.17 kB |

Reduction du JS initial:

- minifie: 1,072.83 kB -> 539.95 kB;
- gzip: 281.70 kB -> 144.26 kB.

## Validation

Commandes a executer avant livraison:

```bash
cd frontend
npm run build

cd ../backend
npm run build
npm run validate:mvp -- all
npm run validate:v1
npm run validate:rc1
```

## Rollback

Rollback simple: restaurer les imports directs dans `frontend/src/App.tsx` et supprimer les constantes `lazy`.

## Recommandations V2

- Ajouter `staleTime` par requete pour les donnees stables: referentiels, sites, roles, permissions, categories, formes, voies, types produits, taux de change.
- Garder POS, caisse, stocks et ventes en cours avec cache court ou revalidation explicite.
- Ajouter une analyse de bundle Rollup dediee si le chunk initial reste trop eleve.
- Envisager une virtualisation ciblee uniquement sur les tables tres longues, apres tests UX clavier/popovers.
- Ajouter pagination backend progressive sur les rapports et analyses volumineux.

