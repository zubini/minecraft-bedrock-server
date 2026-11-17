scoreboard players set @e[tag=cg1_o] cg1_c 0
tickingarea remove cg1_a
kill @e[tag=cg1_o]
tellraw @a {"rawtext":[{"text":"[city_gen_1] Clear fertig."}]}
