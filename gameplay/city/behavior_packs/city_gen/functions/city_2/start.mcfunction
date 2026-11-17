tellraw @a {"rawtext":[{"text":"[city_2] Starte (seed=104771) – Nordwest-Ecke, Fläche nach Ost+Süd …"}]}
scoreboard objectives add cg2_b dummy
tickingarea remove cg2_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg2_o
tag @e[tag=cg2_o,c=1] add city_o
effect @e[tag=cg2_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~108 ~79 cg2_a true
scoreboard players set @e[tag=cg2_o,c=1] cg2_b 1
execute as @e[tag=cg2_o,c=1] at @s run function city_2/terrain_batches/t_00
scoreboard players set @e[tag=cg2_o,c=1] cg2_b 2
tellraw @a {"rawtext":[{"text":"[city_2] Bau läuft (255 Schritte, 16 Häuser) …"}]}
