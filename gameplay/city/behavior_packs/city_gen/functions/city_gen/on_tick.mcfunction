execute if score clear_step city_gen matches 1..31 as @e[type=armor_stand,tag=city_gen_origin,c=1] at @s run function city_gen/clear_advance
execute if score clear_step city_gen matches 1..31 run scoreboard players add clear_step city_gen 1
execute if score clear_step city_gen matches 32 run function city_gen/clear_done
