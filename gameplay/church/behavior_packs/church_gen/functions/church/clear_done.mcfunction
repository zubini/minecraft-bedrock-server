scoreboard players set @e[tag=ch_co] ch_c 0
tickingarea remove ch_ca
kill @e[tag=ch_co]
tellraw @a {"rawtext":[{"text":"[church] Clear fertig."}]}
