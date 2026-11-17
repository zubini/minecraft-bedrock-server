tellraw @a {"rawtext":[{"text":"[townhall] Clear – an die Nordwest-Ecke stellen (32×32) …"}]}
scoreboard objectives add th_c dummy
scoreboard objectives add th_b dummy
tickingarea remove th_ca
tickingarea remove th_a
kill @e[type=armor_stand,tag=th_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add th_co
tag @e[tag=th_co,c=1] add th_o
effect @e[tag=th_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~31 ~36 ~31 th_ca true
scoreboard players set @e[tag=th_co,c=1] th_c 1
execute as @e[tag=th_co,c=1] at @s run function townhall/clear_batches/c_00
scoreboard players set @e[tag=th_co,c=1] th_c 2
tellraw @a {"rawtext":[{"text":"[townhall] Clear läuft (5 Schritte) …"}]}
