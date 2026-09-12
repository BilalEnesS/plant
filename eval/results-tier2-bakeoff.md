# Tier-2 model bake-off — 36 images, open-ended identification

001.jpg  | Sonchus oleraceus          | ✗ Cardamine hirsuta        2054ms    20t | ✗ Cardamine hirsuta        1821ms    22t
002.jpg  | Nicotiana glauca           | ✗ —                        1497ms    12t | ✓ Nicotiana glauca         1649ms    23t
003.jpg  | Tridax procumbens          | ✓ Tridax procumbens        1245ms    18t | ✓ Tridax procumbens        1567ms    24t
004.jpg  | Leucospermum cuneiforme    | ✗ Leucadendron salignum    1584ms    24t | ✗ Leucadendron salignum    2423ms    26t
005.jpg  | Clematis vitalba           | ✗ —                        1172ms    16t | ✗ Syntrichia ruralis       1236ms    23t
006.jpg  | Calandrinia menziesii      | ✗ Capsella bursa-pastori   1740ms    19t | ✗ Ranunculus testiculatu   1594ms    23t
007.jpg  | Lindsaea linearis          | ✗ Asplenium platyneuron    1553ms    22t | ✓ Lindsaea linearis        1482ms    23t
008.jpg  | Pseudopanax linearis       | ✗ Pteris vittata           1416ms    21t | ~ Pseudopanax crassifoli   1689ms    24t
009.jpg  | Phacelia campanularia      | ✗ Heuchera sanguinea       1902ms    21t | ✗ Heuchera americana       1459ms    22t
010.jpg  | Zanthoxylum clava-herculis | ✗ Smilax bona-nox          4622ms    18t | ✗ Aralia spinosa           2360ms    23t
011.jpg  | Polystichum wawranum       | ✗ —                        1335ms    16t | ✗ Bolbitis heudelotii      1308ms    19t
012.jpg  | Olea europaea              | ✓ Olea europaea            1257ms    20t | ✓ Olea europaea            1663ms    22t
013.jpg  | Cecropia maxima            | ~ Cecropia                 1425ms    15t | ~ Cecropia peltata         2148ms    23t
014.jpg  | Vachellia caven            | ✗ Taxodium distichum       1255ms    17t | ~ Vachellia farnesiana     1707ms    26t
015.jpg  | Bartramia ithyphylla       | ✗ Racomitrium canescens    1671ms    18t | ~ Bartramia pomiformis     1673ms    23t
016.jpg  | Phacelia crenulata         | ~ Phacelia tanacetifolia   1501ms    18t | ~ Phacelia distans         1696ms    23t
017.jpg  | Cistus symphytifolius      | ~ Cistus creticus          1569ms    18t | ~ Cistus monspeliensis     2022ms    25t
018.jpg  | Tillandsia setacea         | ~ Tillandsia recurvata     1535ms    23t | ~ Tillandsia recurvata     1921ms    23t
019.jpg  | Alepis flavida             | ✗ Quercus agrifolia        1282ms    21t | ✗ Viscum album             2170ms    21t
020.jpg  | Cercis canadensis          | ✗ Gleditsia triacanthos    1613ms    24t | ✓ Cercis canadensis        2323ms    23t
021.jpg  | Photinia serratifolia      | ✗ Ardisia crenata          1313ms    23t | ✓ Photinia serratifolia    2305ms    23t
022.jpg  | Quercus berberidifolia     | ✓ Quercus berberidifolia   1281ms    18t | ~ Quercus coccifera        1687ms    23t
023.jpg  | Alnus glutinosa            | ✓ Alnus glutinosa          1615ms    16t | ✓ Alnus glutinosa          1985ms    22t
024.jpg  | Cuscuta macrocephala       | ~ Cuscuta                  1476ms    20t | ~ Cuscuta campestris       1922ms    24t
025.jpg  | Veronica persica           | ✓ Veronica persica         1365ms    15t | ✓ Veronica persica         1928ms    21t
026.jpg  | Geum canadense             | ✗ Ajuga reptans            1336ms    20t | ✗ Packera aurea            2129ms    22t
027.jpg  | Pleopeltis michauxiana     | ✗ Mimosa pudica            1633ms    16t | ✓ Pleopeltis michauxiana   1998ms    25t
028.jpg  | Salsola tragus             | ✗ —                        1720ms    16t | ✓ Salsola tragus           1876ms    23t
029.jpg  | Olneya tesota              | ✗ Parkinsonia microphyll   1516ms    18t | ✓ Olneya tesota            1752ms    23t
030.jpg  | Senecio squalidus          | ~ Senecio vulgaris         1638ms    16t | ~ Senecio vulgaris         2161ms    22t
031.jpg  | Cecropia mutisiana         | ✗ Ricinus communis         1350ms    16t | ~ Cecropia peltata         1703ms    23t
032.jpg  | Acacia pycnantha           | ✗ Eucalyptus               1495ms    18t | ✓ Acacia pycnantha         2130ms    23t
033.jpg  | Bellis perennis            | ✓ Bellis perennis          1665ms    16t | ✓ Bellis perennis          1897ms    22t
034.jpg  | Frullania eboracensis      | ✗ —                        1527ms    12t | ✓ Frullania eboracensis    3428ms    25t
035.jpg  | Goodyera oblongifolia      | ✓ Goodyera oblongifolia    1400ms    21t | ✓ Goodyera oblongifolia    1914ms    23t
036.jpg  | Ricinus communis           | ✓ Ricinus communis         1471ms    20t | ✓ Ricinus communis         2215ms    22t

| model | species hit | genus hit | median latency | median tokens | parse failures |
|---|---|---|---|---|---|
| gemini-2.5-flash | 22.2% | 38.9% | 1501ms | 18 | 0/36 |
| gemini-3-flash-preview | 44.4% | 75.0% | 1914ms | 23 | 0/36 |
