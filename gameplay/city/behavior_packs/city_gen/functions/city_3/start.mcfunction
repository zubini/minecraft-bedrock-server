tellraw @a {"rawtext":[{"text":"[city_3] Starte (seed=209500) – Nordwest-Ecke, Fläche nach Ost+Süd …"}]}
scoreboard objectives add cg3_b dummy
tickingarea remove cg3_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg3_o
tag @e[tag=cg3_o,c=1] add city_o
effect @e[tag=cg3_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~108 ~79 cg3_a true
scoreboard players set @e[tag=cg3_o,c=1] cg3_b 1
execute as @e[tag=cg3_o,c=1] at @s run function city_3/terrain_batches/t_00
scoreboard players set @e[tag=cg3_o,c=1] cg3_b 2
tellraw @a {"rawtext":[{"text":"[city_3] Bau läuft (456 Schritte, 16 Häuser) …"}]}
