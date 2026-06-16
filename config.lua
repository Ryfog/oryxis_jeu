Config = {}

-- ====== NOTIFICATION ======
-- URL du webhook Discord du salon staff (a remplir). Ex: https://discord.com/api/webhooks/xxx/yyy
-- /!\ NE PAS commit ta vraie URL ici (secret). Mets-la sur ton serveur uniquement.
Config.Webhook   = ''
Config.BotName   = 'ORYXIS'
Config.BotAvatar = ''   -- optionnel : URL d'une image

-- ====== PLATEAU ======
-- Nombre total de cases du plateau (0 = depart, NbCases = derniere case).
-- 104 cases tracees sur le plateau (index 0..103).
Config.NbCases = 103

-- 1 seul lancer par jour pour TOUT le serveur (le pion n'avance qu'une fois/jour).
Config.OneRollPerDay = true

-- Exiger que le joueur possede l'item pour lancer (relocalisation manuelle par le staff).
Config.RequireItem = true
Config.ItemName    = 'oryxis'

-- Permission staff pour la version Maitre du jeu (/oryxisadmin, /oryxiscarte ...)
Config.AdminAce = 'oryxis.admin'
-- Fallback : groupes ESX consideres comme staff (plus fiable que l'ace sur ESX)
Config.AdminGroups = { 'owner', 'superadmin', 'admin', 'mod', '_dev' }

-- ====== CARTES PAR DEFAUT ======
-- L'admin en ajoute/retire en jeu via /oryxiscarte ; elles sont stockees en KVP (persistant).
-- type 'event' = encart rouge ; type 'defi' = encart violet (defi obligatoire).
-- move = deplacement applique apres la carte (peut etre 0).
Config.DefaultCards = {
  { type = 'event', title = 'DES BRUITS AU LOIN...', effect = 'RECULE DE 2 CASES.', move = -2 },
  { type = 'event', title = 'VENT FAVORABLE',        effect = 'AVANCE DE 2 CASES.', move = 2 },
  { type = 'event', title = 'EBOULEMENT',            effect = 'RECULE DE 1 CASE.',  move = -1 },
  { type = 'defi',  title = 'PIEGE ANCIEN',          effect = 'RESTE IMMOBILE 30 SECONDES.', move = 0 },
  { type = 'defi',  title = "L'APPEL D'ORYXIS",      effect = 'REJOINS LE POINT MARQUE.',     move = 0 },
}
