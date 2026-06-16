-- ============================ ORYXIS - serveur ============================
-- Etat persistant (KVP) : position du pion, cooldown 1/jour, deck de cartes.
-- Lancer "server-authoritative" + notification webhook Discord au staff.

local pos          = 0
local lastRollDay  = ''
local lastRoller   = ''
local cards        = {}
local forcedNext   = -1   -- index (0-based, cote NUI) de la carte forcee par le staff (-1 = aleatoire)

local function today() return os.date('%Y-%m-%d') end

-- ---------- persistance ----------
local function save()
    SetResourceKvpInt('oryxis_pos', pos)
    SetResourceKvp('oryxis_lastRollDay', lastRollDay)
    SetResourceKvp('oryxis_lastRoller', lastRoller)
    SetResourceKvp('oryxis_cards', json.encode(cards))
end

local function load()
    pos         = GetResourceKvpInt('oryxis_pos') or 0
    lastRollDay = GetResourceKvpString('oryxis_lastRollDay') or ''
    lastRoller  = GetResourceKvpString('oryxis_lastRoller') or ''
    local raw   = GetResourceKvpString('oryxis_cards')
    if raw then
        local ok, d = pcall(json.decode, raw)
        if ok and type(d) == 'table' and #d > 0 then cards = d end
    end
    if #cards == 0 then            -- premier demarrage : on seed avec les cartes par defaut
        cards = Config.DefaultCards
        save()
    end
end

AddEventHandler('onResourceStart', function(res)
    if res == GetCurrentResourceName() then math.randomseed(os.time()); load() end
end)

-- ---------- webhook Discord ----------
local function notify(src, die, from, to, card)
    if not Config.Webhook or Config.Webhook == '' then return end
    local name = GetPlayerName(src) or 'Inconnu'
    local ids  = {}
    for _, id in ipairs(GetPlayerIdentifiers(src)) do
        if id:find('license:') or id:find('discord:') or id:find('steam:') then ids[#ids+1] = id end
    end
    local color = (card and card.type == 'defi') and 8388736 or 13320710  -- violet / rouge
    local embed = {{
        title = '🎲 Un joueur a lance le de ORYXIS',
        color = color,
        fields = {
            { name = 'Joueur',   value = ('**%s** (ID %d)'):format(name, src), inline = true },
            { name = 'De',       value = tostring(die), inline = true },
            { name = 'Case',     value = ('%d → %d / %d'):format(from, to, Config.NbCases), inline = true },
            { name = (card and card.type == 'defi') and '🟣 DEFI' or '🟥 Evenement',
              value = card and (('**%s**\n%s'):format(card.title or '?', card.effect or '')) or 'aucune', inline = false },
            { name = 'Identifiants', value = '```'..table.concat(ids, '\n')..'```', inline = false },
            { name = '➜ Action staff', value = 'Recupere le jeu dans son inventaire et place-le ailleurs.', inline = false },
        },
        footer = { text = 'ORYXIS • '..os.date('%d/%m/%Y %H:%M') },
    }}
    PerformHttpRequest(Config.Webhook, function() end, 'POST',
        json.encode({ username = Config.BotName, avatar_url = Config.BotAvatar ~= '' and Config.BotAvatar or nil, embeds = embed }),
        { ['Content-Type'] = 'application/json' })
end

-- ---------- possession item (ox_inventory) ----------
local function hasItem(src)
    if not Config.RequireItem then return true end
    local ok, count = pcall(function()
        return exports.ox_inventory:Search(src, 'count', Config.ItemName)
    end)
    return ok and type(count) == 'number' and count > 0
end

-- tire une carte de defi (au centre, le jeu ne finit jamais : que des defis)
local function pickDefi()
    local defis = {}
    for _, c in ipairs(cards) do if c.type == 'defi' then defis[#defis+1] = c end end
    if #defis == 0 then return cards[math.random(1, #cards)] end
    return defis[math.random(1, #defis)]
end

-- ---------- callbacks NUI ----------
lib.callback.register('oryxis:getState', function(src)
    return {
        pos      = pos,
        nbCases  = Config.NbCases,
        canRoll  = (not Config.OneRollPerDay) or (lastRollDay ~= today()),
        hasItem  = hasItem(src),
        name     = GetPlayerName(src),   -- nom affiche dans "Bienvenue, ..." (remplacable par le nom RP)
    }
end)

lib.callback.register('oryxis:roll', function(src)
    if Config.OneRollPerDay and lastRollDay == today() then
        return { ok = false, reason = 'cooldown' }
    end
    if not hasItem(src) then
        return { ok = false, reason = 'noitem' }
    end

    local die  = math.random(1, 6)
    local from = pos
    pos = math.min(Config.NbCases, pos + die)
    local landed = pos
    local atCenter = pos >= Config.NbCases

    local card
    if forcedNext >= 0 and cards[forcedNext + 1] then
        -- carte choisie par le staff pour ce lancer (puis retour a l'aleatoire)
        card = cards[forcedNext + 1]
        forcedNext = -1
        if not atCenter and card.move and card.move ~= 0 then
            pos = math.max(0, math.min(Config.NbCases, pos + card.move))
        end
    elseif atCenter then
        -- au centre : aucune sortie, le pion reste et on tire un nouveau defi a chaque lancer
        card = pickDefi()
    else
        card = cards[math.random(1, #cards)]
        if card and card.move and card.move ~= 0 then
            pos = math.max(0, math.min(Config.NbCases, pos + card.move))
        end
    end

    lastRollDay = today()
    lastRoller  = GetPlayerName(src)
    save()
    notify(src, die, from, pos, card)

    return { ok = true, die = die, from = from, landed = landed, to = pos, nbCases = Config.NbCases, card = card }
end)

-- ---------- version staff : callbacks admin (securises par ACE) ----------
local function isAdmin(src) return src == 0 or IsPlayerAceAllowed(src, Config.AdminAce) end

lib.callback.register('oryxis:admin:get', function(src)
    if not isAdmin(src) then return { ok = false } end
    return { ok = true, cards = cards, next = forcedNext, pos = pos, nbCases = Config.NbCases }
end)

lib.callback.register('oryxis:admin:save', function(src, index, card)
    if not isAdmin(src) then return false end
    if type(card) ~= 'table' or not card.title or card.title == '' then return false end
    local c = { type = (card.type == 'event') and 'event' or 'defi',
                title = tostring(card.title), effect = tostring(card.effect or ''),
                move = math.floor(tonumber(card.move) or 0) }
    if index and index >= 0 and cards[index + 1] then cards[index + 1] = c else cards[#cards + 1] = c end
    save(); return true
end)

lib.callback.register('oryxis:admin:delete', function(src, index)
    if not isAdmin(src) then return false end
    if index and cards[index + 1] then table.remove(cards, index + 1) end
    if forcedNext == index then forcedNext = -1 elseif index and forcedNext > index then forcedNext = forcedNext - 1 end
    save(); return true
end)

lib.callback.register('oryxis:admin:setNext', function(src, index)
    if not isAdmin(src) then return false end
    forcedNext = (type(index) == 'number') and index or -1
    return true
end)

-- ---------- editeur de cartes (CLI alternatif) ----------

RegisterCommand('oryxiscarte', function(src, args)
    if not isAdmin(src) then return end
    local sub = (args[1] or ''):lower()

    if sub == 'list' then
        local function out(m) if src == 0 then print(m) else TriggerClientEvent('chat:addMessage', src, { args = { '^3[ORYXIS]', m } }) end end
        out(('%d carte(s) :'):format(#cards))
        for i, c in ipairs(cards) do out(('%d. [%s] %s — %s (move %d)'):format(i, c.type, c.title, c.effect, c.move or 0)) end

    elseif sub == 'del' then
        local i = tonumber(args[2])
        if i and cards[i] then table.remove(cards, i); save() end

    elseif sub == 'add' then
        -- /oryxiscarte add <event|defi> <move> <titre | effet>
        local t = (args[2] or 'event'):lower(); if t ~= 'defi' then t = 'event' end
        local mv = tonumber(args[3]) or 0
        local rest = table.concat(args, ' ', 4)
        local title, effect = rest:match('^(.-)%s*|%s*(.+)$')
        if not title then title, effect = rest, '' end
        if title and title ~= '' then
            cards[#cards+1] = { type = t, title = title:upper(), effect = effect:upper(), move = mv }
            save()
        end
    else
        if src ~= 0 then
            TriggerClientEvent('chat:addMessage', src, { args = { '^3[ORYXIS]',
                'Usage: /oryxiscarte add <event|defi> <move> <Titre | Effet>  •  /oryxiscarte list  •  /oryxiscarte del <n>' } })
        end
    end
end, false)

-- reset admin (repositionner le pion / debloquer)
RegisterCommand('oryxisreset', function(src, args)
    if not isAdmin(src) then return end
    pos = tonumber(args[1]) or 0
    lastRollDay = ''
    save()
    if src ~= 0 then TriggerClientEvent('chat:addMessage', src, { args = { '^2[ORYXIS]', ('Pion case %d, cooldown reset.'):format(pos) } }) end
end, false)
