# ORYXIS — Jeu de plateau (Jumanji) pour FiveM

Mini-jeu de plateau NUI, **partie unique partagée** par tout le serveur, qui ne finit jamais
(inspiration Jumanji). Un seul pion avance sur le plateau ; le jeu se transmet via **un item unique**
que le staff déplace de joueur en joueur. **Un seul lancer de dé par jour.** Chaque lancer déclenche
un **événement** ou un **défi obligatoire** (cartes écrites par le staff). Au centre, aucune sortie :
le jeu continue avec de nouveaux défis.

## Dépendances
- [`ox_lib`](https://github.com/overextended/ox_lib)
- [`ox_inventory`](https://github.com/overextended/ox_inventory)

## Installation
1. Mettre le dossier `oryxis_jeu` dans `resources/[ressources]/`.
2. Dans `server.cfg` : `ensure oryxis_jeu` (après ox_lib et ox_inventory).
3. **Webhook Discord** : ouvrir `config.lua` et renseigner `Config.Webhook` avec l'URL du webhook
   de ton salon staff (tu reçois une notif à chaque lancer : joueur, dé, case, carte, identifiants).
   ⚠️ Ne committe jamais ta vraie URL.
4. **Permission staff** : donner l'ACE `oryxis.admin` à tes grades staff, ex. dans `server.cfg` :
   ```
   add_ace group.admin oryxis.admin allow
   ```
5. **Item ox_inventory** : ajouter l'item dans `ox_inventory/data/items.lua` :
   ```lua
   ['oryxis_jeu'] = {
       label = "Jeu d'Oryxis",
       weight = 1000,
       stack = false,
       close = true,
       description = "Un vieux jeu de plateau... il vaudrait mieux ne pas y toucher.",
       client = { export = 'oryxis_jeu.openGame' }
   },
   ```
   (Mets une image `oryxis_jeu.png` dans `ox_inventory/web/images/` si tu veux une icône.)

## Utilisation
- **Joueur** : utiliser l'item (ou `/oryxis`) → écran « Reprendre la partie » → **Lancer le dé** (1×/jour).
  Après le lancer : **le staff récupère l'item** dans l'inventaire du joueur et le replace ailleurs
  (la relocalisation est **manuelle**).
- **Staff** (Maître du jeu) : `/oryxisadmin` → gérer les cartes (ajouter / éditer / supprimer) et
  **forcer la prochaine carte**. Tout est enregistré côté serveur (KVP) et persistant.
- Commandes CLI alternatives (staff) :
  - `/oryxiscarte add <event|defi> <déplacement> <Titre | Effet>`
  - `/oryxiscarte list` · `/oryxiscarte del <n>`
  - `/oryxisreset <case>` (repositionne le pion + débloque le lancer du jour)

## Le plateau
- Image : `html/board.png`. Le parcours des cases est défini dans `PATH` (`html/script.js`),
  tracé case par case (édité via le mode `?edit` en navigateur).
- `Config.NbCases` (config.lua) = nombre de cases (doit correspondre à la longueur de `PATH`).

## Crédits
Jeu développé pour le serveur **Oryxis**.
