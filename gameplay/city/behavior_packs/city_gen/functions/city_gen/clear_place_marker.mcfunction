tellraw @a {"rawtext":[{"text":"[city_gen] Kein Origin-Marker – Clear vom aktuellen Standpunkt (gleiche Blickrichtung)."}]}
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=2,c=1] add city_gen_origin
tp @e[type=armor_stand,tag=city_gen_origin,c=1] ~ ~ ~ facing ^0 ^0 ^1
effect @e[type=armor_stand,tag=city_gen_origin] invisibility 999999 0 true
