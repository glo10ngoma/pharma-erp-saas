# UI/UX Guidelines V1.1

Ce document formalise progressivement l'identite visuelle de l'ERP Pharmaceutique SaaS.

## Couleurs

- Mode clair : fond clair, cartes blanches, bordures legeres.
- Mode sombre : fond sombre, cartes sombres, texte lisible.
- Couleur primaire : bleu professionnel pour les actions principales, les selections et les points d'attention.
- Couleur succes : vert pour les etats valides, confirmations et resultats positifs.
- Couleur alerte : orange pour les avertissements, echeances proches et champs incomplets.
- Couleur erreur : rouge pour les erreurs bloquantes et validations impossibles.
- Couleur information : bleu clair pour les informations secondaires ou contextuelles.

## Layout

- Sidebar stable de 280px.
- Navigation organisee par groupes metier.
- Sous-menus verticaux, lisibles, sans debordement horizontal.
- Pages structurees en cartes simples.
- Modals larges pour les ecrans metier riches, notamment achats, ventes et inventaires.
- Les flux complexes peuvent rester en pages dediees quand l'espace de travail le justifie.

## Tableaux

- En-tetes lisibles avec contraste suffisant en light et dark mode.
- Valeurs numeriques alignees a droite.
- Badges de statut coherents sur tous les modules.
- Barre de recherche au-dessus des listes.
- Empty state clair lorsque la liste est vide.
- Sticky header quand le tableau est long.
- Colonne principale figee lorsque le tableau est large.
- Scroll horizontal propre sur ecran portable.

## Formulaires

- Labels clairs pour chaque champ.
- Pas de longues descriptions sous les champs.
- Placeholders courts et utiles.
- Champs obligatoires visibles par le contexte et la validation.
- Validation visuelle proche du champ ou de la ligne concernee.
- Modals pour les creations simples.
- Pages dediees pour les flux complexes ou longs.

## Raccourcis clavier

- `Ctrl+Entree` : enregistrer.
- `Ctrl+L` : ajouter une ligne.
- `Ctrl+Suppr` : supprimer la ligne selectionnee.
- `Echap` : fermer la modal.
- `Entree` : passer a la ligne suivante ou valider la ligne rapide.
- `Tab` : cellule suivante.
- `Shift+Tab` : cellule precedente.

## Argent, Dates Et Statuts

- Utiliser `formatMoney()` pour tous les montants visibles.
- Afficher explicitement la devise : `USD` ou `FC`.
- Badges de statut coherents entre modules.
- Dates au format lisible pour l'utilisateur.
- Les montants consolides restent explicites sur leur devise de reporting.
