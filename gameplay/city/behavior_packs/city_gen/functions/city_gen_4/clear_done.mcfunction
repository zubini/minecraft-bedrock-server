scoreboard players set @e[tag=cg4_o] cg4_c 0
tickingarea remove cg4_a
kill @e[tag=cg4_o]
tellraw @a {"rawtext":[{"text":"[city_gen_4] Clear fertig."}]}
