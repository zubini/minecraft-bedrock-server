scoreboard players set clear_step city_gen 0
kill @e[type=armor_stand,tag=city_gen_origin]
tellraw @a {"rawtext":[{"text":"[city_gen] Clear fertig."}]}
