scoreboard players set @e[tag=cg_t_o] cg_t 0
tickingarea remove cg_t_a
kill @e[tag=cg_t_o]
tellraw @a {"rawtext":[{"text":"[city] Terrain fertig. Danach z.B. /function city_1/start"}]}
