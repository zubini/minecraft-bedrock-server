tellraw @a {"rawtext":[{"text":"[church] Clear – an die Nordwest-Ecke stellen (24×40) …"}]}
scoreboard objectives add ch_c dummy
scoreboard objectives add ch_b dummy
tickingarea remove ch_ca
tickingarea remove ch_a
kill @e[type=armor_stand,tag=ch_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add ch_co
tag @e[tag=ch_co,c=1] add ch_o
effect @e[tag=ch_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~23 ~43 ~39 ch_ca true
scoreboard players set @e[tag=ch_co,c=1] ch_c 1
execute as @e[tag=ch_co,c=1] at @s run function church/clear_batches/c_00
scoreboard players set @e[tag=ch_co,c=1] ch_c 2
tellraw @a {"rawtext":[{"text":"[church] Clear läuft (5 Schritte) …"}]}
