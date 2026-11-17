tellraw @a {"rawtext":[{"text":"[city_1] Starte (seed=42) – Nordwest-Ecke, Fläche nach Ost+Süd …"}]}
scoreboard objectives add cg1_b dummy
tickingarea remove cg1_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg1_o
tag @e[tag=cg1_o,c=1] add city_o
effect @e[tag=cg1_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~108 ~79 cg1_a true
scoreboard players set @e[tag=cg1_o,c=1] cg1_b 1
execute as @e[tag=cg1_o,c=1] at @s run function city_1/terrain_batches/t_00
scoreboard players set @e[tag=cg1_o,c=1] cg1_b 2
tellraw @a {"rawtext":[{"text":"[city_1] Bau läuft (355 Schritte, 16 Häuser) …"}]}
