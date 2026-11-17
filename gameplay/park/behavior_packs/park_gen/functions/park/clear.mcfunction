tellraw @a {"rawtext":[{"text":"[park] Clear – an die Nordwest-Ecke stellen (48×48) …"}]}
scoreboard objectives add pk_c dummy
scoreboard objectives add pk_b dummy
tickingarea remove pk_ca
tickingarea remove pk_a
kill @e[type=armor_stand,tag=pk_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add pk_co
tag @e[tag=pk_co,c=1] add pk_o
effect @e[tag=pk_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~47 ~20 ~47 pk_ca true
scoreboard players set @e[tag=pk_co,c=1] pk_c 1
execute as @e[tag=pk_co,c=1] at @s run function park/clear_batches/c_00
scoreboard players set @e[tag=pk_co,c=1] pk_c 2
tellraw @a {"rawtext":[{"text":"[park] Clear läuft (7 Schritte) …"}]}
