tellraw @a {"rawtext":[{"text":"[city_5] Starte (seed=418958) – Nordwest-Ecke, Fläche nach Ost+Süd …"}]}
scoreboard objectives add cg5_b dummy
tickingarea remove cg5_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg5_o
tag @e[tag=cg5_o,c=1] add city_o
effect @e[tag=cg5_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~108 ~79 cg5_a true
scoreboard players set @e[tag=cg5_o,c=1] cg5_b 1
execute as @e[tag=cg5_o,c=1] at @s run function city_5/terrain_batches/t_00
scoreboard players set @e[tag=cg5_o,c=1] cg5_b 2
tellraw @a {"rawtext":[{"text":"[city_5] Bau läuft (486 Schritte, 16 Häuser) …"}]}
