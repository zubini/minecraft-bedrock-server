scoreboard players set @e[tag=cg2_o] cg2_c 0
tickingarea remove cg2_a
kill @e[tag=cg2_o]
tellraw @a {"rawtext":[{"text":"[city_gen_2] Clear fertig."}]}
