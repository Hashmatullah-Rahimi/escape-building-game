FIVE FLOORS OUT - code pack

web/     The browser game (HTML + CSS + JavaScript). Open web/index.html in a browser.
         index.html = page structure, style.css = look, game.js = all floors and rules.
python/  game.py   Text version of the 5 floors.   Run: python3 game.py
cpp/     game.cpp  Text version of the 5 floors.   Build: g++ -std=c++17 game.cpp -o game
cnn/     cnn_example.py  Optional small CNN (PyTorch). The game does not need it.

Lose rules (same in every version):
 floor 1 -> stay on floor 1 | floors 2, 3, 4 -> one floor down | floor 5 -> floor 1
