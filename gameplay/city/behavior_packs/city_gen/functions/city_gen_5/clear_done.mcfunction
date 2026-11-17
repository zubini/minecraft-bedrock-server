scoreboard players set @e[tag=cg5_o] cg5_c 0
tickingarea remove cg5_a
kill @e[tag=cg5_o]
tellraw @a {"rawtext":[{"text":"[city_gen_5] Clear fertig."}]}
