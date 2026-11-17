tellraw @a {"rawtext":[{"text":"[school] Clear – an die Nordwest-Ecke stellen (36×48) …"}]}
scoreboard objectives add sc_c dummy
scoreboard objectives add sc_b dummy
tickingarea remove sc_ca
tickingarea remove sc_a
kill @e[type=armor_stand,tag=sc_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add sc_co
tag @e[tag=sc_co,c=1] add sc_o
effect @e[tag=sc_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~35 ~26 ~47 sc_ca true
scoreboard players set @e[tag=sc_co,c=1] sc_c 1
execute as @e[tag=sc_co,c=1] at @s run function school/clear_batches/c_00
scoreboard players set @e[tag=sc_co,c=1] sc_c 2
tellraw @a {"rawtext":[{"text":"[school] Clear läuft (5 Schritte) …"}]}
