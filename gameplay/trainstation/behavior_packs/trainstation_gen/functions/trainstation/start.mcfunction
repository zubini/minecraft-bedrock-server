tellraw @a {"rawtext":[{"text":"[trainstation] Starte – Nordwest-Ecke, Fläche 48×56 nach Ost+Süd …"}]}
scoreboard objectives add ts_b dummy
scoreboard objectives add ts_c dummy
tickingarea remove ts_a
tickingarea remove ts_ca
kill @e[type=armor_stand,tag=ts_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add ts_o
tag @e[tag=ts_o,c=1] add ts_o
effect @e[tag=ts_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~47 ~30 ~55 ts_a true
scoreboard players set @e[tag=ts_o,c=1] ts_b 1
execute as @e[tag=ts_o,c=1] at @s run function trainstation/build_batches/b_00
scoreboard players set @e[tag=ts_o,c=1] ts_b 2
tellraw @a {"rawtext":[{"text":"[trainstation] Bau läuft (10 Schritte) …"}]}
