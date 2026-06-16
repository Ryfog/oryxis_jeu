fx_version 'cerulean'
game 'gta5'

author 'Oryxis'
description 'Jeu de plateau ORYXIS (NUI) - style Jumanji, partie unique partagee'
version '0.2.0'

ui_page 'html/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua'
}
client_script 'client.lua'
server_script 'server.lua'

dependencies {
    'ox_lib',
    'ox_inventory'
}

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/board.png',
    'html/pawn.png'
}
