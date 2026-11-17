scoreboard players set @e[tag=cg_c_o] cg_c 0
tickingarea remove cg_c_a
kill @e[tag=cg_c_o]
tellraw @a {"rawtext":[{"text":"[city] Clear fertig."}]}
