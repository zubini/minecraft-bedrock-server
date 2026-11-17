tellraw @a {"rawtext":[{"text":"[city_gen] Clear … (läuft über mehrere Ticks)"}]}
scoreboard objectives add city_gen dummy
execute unless entity @e[type=armor_stand,tag=city_gen_origin] run function city_gen/clear_place_marker
scoreboard players set clear_step city_gen 1
