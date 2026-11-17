tellraw @a {"rawtext":[{"text":"[stadium] Clear – an die Nordwest-Ecke stellen (70×100) …"}]}
scoreboard objectives add st_c dummy
scoreboard objectives add st_b dummy
tickingarea remove st_ca
tickingarea remove st_a
kill @e[type=armor_stand,tag=st_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add st_co
tag @e[tag=st_co,c=1] add st_o
effect @e[tag=st_co] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~69 ~36 ~99 st_ca true
scoreboard players set @e[tag=st_co,c=1] st_c 1
execute as @e[tag=st_co,c=1] at @s run function stadium/clear_batches/c_00
scoreboard players set @e[tag=st_co,c=1] st_c 2
tellraw @a {"rawtext":[{"text":"[stadium] Clear läuft (23 Schritte) …"}]}
