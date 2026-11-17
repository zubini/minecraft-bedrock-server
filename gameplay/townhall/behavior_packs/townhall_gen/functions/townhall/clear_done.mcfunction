scoreboard players set @e[tag=th_co] th_c 0
tickingarea remove th_ca
kill @e[tag=th_co]
tellraw @a {"rawtext":[{"text":"[townhall] Clear fertig."}]}
