tellraw @a {"rawtext":[{"text":"[trainstation] Clear – an die Nordwest-Ecke stellen (48×56) …"}]}
scoreboard objectives add ts_c dummy
scoreboard objectives add ts_b dummy
tickingarea remove ts_ca
tickingarea remove ts_a
kill @e[type=armor_stand,tag=ts_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add ts_co
tag @e[tag=ts_co,c=1] add ts_o
effect @e[tag=ts_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~47 ~30 ~55 ts_ca true
scoreboard players set @e[tag=ts_co,c=1] ts_c 1
execute as @e[tag=ts_co,c=1] at @s run function trainstation/clear_batches/c_00
scoreboard players set @e[tag=ts_co,c=1] ts_c 2
tellraw @a {"rawtext":[{"text":"[trainstation] Clear läuft (9 Schritte) …"}]}
