scoreboard players set @e[tag=sc_co] sc_c 0
tickingarea remove sc_ca
kill @e[tag=sc_co]
tellraw @a {"rawtext":[{"text":"[school] Clear fertig."}]}
