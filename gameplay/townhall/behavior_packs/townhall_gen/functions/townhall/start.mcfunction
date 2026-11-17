tellraw @a {"rawtext":[{"text":"[townhall] Starte – Nordwest-Ecke, Fläche 32×32 nach Ost+Süd …"}]}
scoreboard objectives add th_b dummy
scoreboard objectives add th_c dummy
tickingarea remove th_a
tickingarea remove th_ca
kill @e[type=armor_stand,tag=th_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add th_o
tag @e[tag=th_o,c=1] add th_o
effect @e[tag=th_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~31 ~36 ~31 th_a true
scoreboard players set @e[tag=th_o,c=1] th_b 1
execute as @e[tag=th_o,c=1] at @s run function townhall/build_batches/b_00
scoreboard players set @e[tag=th_o,c=1] th_b 2
tellraw @a {"rawtext":[{"text":"[townhall] Bau läuft (4 Schritte) …"}]}
