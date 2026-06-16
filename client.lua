-- ============================ ORYXIS - client ============================
-- Ouverture du NUI (item ou /oryxis), relais des actions vers le serveur.

local isOpen = false

local function openUI()
    if isOpen then return end
    isOpen = true
    local state = lib.callback.await('oryxis:getState', false)   -- pos / canRoll / nbCases / hasItem
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open', state = state })
end

local function closeUI()
    if not isOpen then return end
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

-- ouverture par la commande (test) et par l'item ox_inventory
RegisterCommand('oryxis', openUI, false)
exports('openGame', openUI)   -- ox_inventory : client = { export = 'oryxis_jeu.openGame' }
RegisterNetEvent('oryxis_jeu:open', openUI)   -- itemcreator "Evenement personnalise" (event CLIENT) -> oryxis_jeu:open

-- le NUI demande un lancer -> on relaie au serveur (autorite) et on renvoie le resultat
RegisterNUICallback('roll', function(_, cb)
    local res = lib.callback.await('oryxis:roll', false)
    cb(res or { ok = false, reason = 'error' })
end)

RegisterNUICallback('getState', function(_, cb)
    cb(lib.callback.await('oryxis:getState', false))
end)

RegisterNUICallback('close', function(_, cb)
    isOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

-- ===== VERSION STAFF (gestion des defis) =====
RegisterCommand('oryxisadmin', function()
    local data = lib.callback.await('oryxis:admin:get', false)
    if not data or not data.ok then
        TriggerEvent('chat:addMessage', { args = { '^1[ORYXIS]', 'Reserve au staff (permission oryxis.admin).' } })
        return
    end
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'openAdmin', cards = data.cards, next = data.next })
end, false)

RegisterNUICallback('adminSave', function(d, cb)
    cb(lib.callback.await('oryxis:admin:save', false, d.index, d.card))
end)
RegisterNUICallback('adminDelete', function(d, cb)
    cb(lib.callback.await('oryxis:admin:delete', false, d.index))
end)
RegisterNUICallback('adminSetNext', function(d, cb)
    cb(lib.callback.await('oryxis:admin:setNext', false, d.index))
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and isOpen then SetNuiFocus(false, false) end
end)
