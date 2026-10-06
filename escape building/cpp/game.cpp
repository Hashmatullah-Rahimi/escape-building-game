// Five Floors Out - text version in C++.
// Build:  g++ -std=c++17 game.cpp -o game     Run: ./game
#include <algorithm>
#include <chrono>
#include <iostream>
#include <random>
#include <string>
#include <vector>
using namespace std;

mt19937 rng(random_device{}());
int rnd(int a, int b) { return uniform_int_distribution<int>(a, b)(rng); }
const int LOSE_TO[6] = {0, 1, 1, 2, 3, 1};   // where you go after losing floor n

string ask(const string& p) {
    cout << p;
    string s;
    if (!getline(cin, s)) exit(0);
    return s;
}

// ---------- Floor 1 ----------
int safePit = rnd(1, 3);
bool floor1() {
    cout << "\nFLOOR 1 - FIND YOUR WAY\nThree fire pits: 1, 2, 3. One hides a stone.\n";
    int c = 0;
    while (c < 1 || c > 3) { string s = ask("Which pit? (1/2/3): "); c = s.empty() ? 0 : s[0] - '0'; }
    if (c == safePit) { cout << "You land on cold stone!\n"; return true; }
    cout << "The fire burns you!\n";
    do { safePit = rnd(1, 3); } while (safePit == c);   // safe pit moves (never the same one)
    return false;
}

// ---------- Floor 2 ----------
bool floor2() {
    cout << "\nFLOOR 2 - THE BRIDGE\nw = walk, j = jump. '_' is a gap.\n";
    string bridge = "...._..._...._...._...";
    size_t pos = 0;
    while (pos + 1 < bridge.size()) {
        string show = bridge; show[pos] = 'P';
        cout << "Bridge: " << show << "\n";
        string m = ask("w = walk, j = jump: ");
        if (!m.empty() && m[0] == 'j') {
            pos += (bridge[pos + 1] == '_') ? 2 : 1;
            if (pos >= bridge.size() || bridge[pos] == '_') { cout << "You fall!\n"; return false; }
        } else {
            pos += 1;
            if (bridge[pos] == '_') { cout << "You stepped into a gap and fell!\n"; return false; }
        }
    }
    cout << "You crossed the bridge!\n";
    return true;
}

// ---------- Floor 3 ----------
bool floor3() {
    cout << "\nFLOOR 3 - FIND THE RIGHT PATH\nMove with w/a/s/d. P = you, E = exit.\n";
    const int CW = 6, CH = 4, COLS = 2 * CW + 1, ROWS = 2 * CH + 1;
    vector<string> g(ROWS, string(COLS, '#'));
    vector<vector<bool>> seen(CH, vector<bool>(CW, false));
    vector<pair<int, int>> st{{0, 0}};
    seen[0][0] = true; g[1][1] = ' ';
    int DX[4] = {1, -1, 0, 0}, DY[4] = {0, 0, 1, -1};
    while (!st.empty()) {
        auto [x, y] = st.back();
        vector<int> nb;
        for (int d = 0; d < 4; d++) {
            int nx = x + DX[d], ny = y + DY[d];
            if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && !seen[ny][nx]) nb.push_back(d);
        }
        if (nb.empty()) { st.pop_back(); continue; }
        int d = nb[rnd(0, (int)nb.size() - 1)];
        int nx = x + DX[d], ny = y + DY[d];
        g[2 * y + 1 + DY[d]][2 * x + 1 + DX[d]] = ' ';
        g[2 * ny + 1][2 * nx + 1] = ' ';
        seen[ny][nx] = true; st.push_back({nx, ny});
    }
    int px = 1, py = 1, ex = COLS - 2, ey = ROWS - 2;
    while (px != ex || py != ey) {
        for (int y = 0; y < ROWS; y++) {
            string line = g[y];
            if (y == py) line[px] = 'P';
            if (y == ey) line[ex] = (y == py && px == ex) ? 'P' : 'E';
            cout << line << "\n";
        }
        string m = ask("Move (w/a/s/d): ");
        int dx = 0, dy = 0;
        if (!m.empty()) { if (m[0]=='w') dy=-1; else if (m[0]=='s') dy=1; else if (m[0]=='a') dx=-1; else if (m[0]=='d') dx=1; }
        if ((dx || dy) && g[py + dy][px + dx] == ' ') { px += dx; py += dy; }
        else cout << "Wall! Pick another way.\n";
    }
    cout << "You found the exit!\n";
    return true;
}

// ---------- Floor 4 ----------
struct Q { string q; vector<string> a; };   // a[0] is the correct answer
bool floor4() {
    cout << "\nFLOOR 4 - FIVE QUESTIONS\n4 right = win. 2 wrong = you lose.\n";
    vector<Q> bank = {
        {"print(7 // 2) shows?", {"3", "3.5", "4", "2"}},
        {"Keyword that defines a function?", {"def", "func", "function", "define"}},
        {"len('hello') is?", {"5", "4", "6", "hello"}},
        {"print(2 ** 3) shows?", {"8", "6", "5", "9"}},
        {"print('py' * 3) shows?", {"pypypy", "py3", "py py py", "Error"}},
        {"Which one is immutable?", {"tuple", "list", "dict", "set"}},
        {"bool('') is?", {"False", "True", "None", "Error"}},
    };
    shuffle(bank.begin(), bank.end(), rng);
    int right = 0, wrong = 0;
    for (int i = 0; i < 5; i++) {
        vector<string> o = bank[i].a;
        shuffle(o.begin(), o.end(), rng);
        cout << "\n" << bank[i].q << "\n";
        for (int k = 0; k < 4; k++) cout << "  " << k + 1 << ") " << o[k] << "\n";
        string s = ask("Answer (1-4): ");
        int c = s.empty() ? 0 : s[0] - '0';
        if (c >= 1 && c <= 4 && o[c - 1] == bank[i].a[0]) { right++; cout << "Correct!\n"; }
        else { wrong++; cout << "Wrong! It was: " << bank[i].a[0] << "\n"; }
        if (right >= 4) return true;
        if (wrong >= 2) return false;
    }
    return right >= 4;
}

// ---------- Floor 5 ----------
bool floor5() {
    cout << "\nFLOOR 5 - BUILD THE DOOR\nPut the lines in the right order within 120 seconds.\n";
    vector<string> code = {
        "def unlock(pin):", "    if pin == 4821:", "        return \"OPEN\"",
        "    return \"LOCKED\"", "result = unlock(4821)", "print(result)"};
    int n = code.size();
    vector<int> order(n);
    for (int i = 0; i < n; i++) order[i] = i;
    do { shuffle(order.begin(), order.end(), rng); } while (is_sorted(order.begin(), order.end()));
    for (int i = 0; i < n; i++) cout << "  " << i + 1 << ") " << code[order[i]] << "\n";
    auto start = chrono::steady_clock::now();
    while (true) {
        cout << "Type " << n << " line numbers separated by spaces: ";
        string line; if (!getline(cin, line)) exit(0);
        if (chrono::steady_clock::now() - start > chrono::seconds(120)) { cout << "Time is up!\n"; return false; }
        vector<int> a; int v; size_t p = 0;
        try { while (p < line.size()) { size_t used; v = stoi(line.substr(p), &used); a.push_back(v); p += used; } } catch (...) {}
        bool ok = (int)a.size() == n;
        for (int x : a) if (x < 1 || x > n) ok = false;
        if (!ok) { cout << "Give all " << n << " numbers.\n"; continue; }
        bool right = true;
        for (int i = 0; i < n; i++) if (order[a[i] - 1] != i) right = false;
        if (right) { cout << "The door opens! The helicopter is waiting...\n"; return true; }
        cout << "The program does not run correctly. Try again.\n";
    }
}

int main() {
    int floor = 1;
    while (floor <= 5) {
        cout << "\n=== You are on floor " << floor << " ===\n";
        bool won = floor == 1 ? floor1() : floor == 2 ? floor2() : floor == 3 ? floor3() : floor == 4 ? floor4() : floor5();
        if (won) floor++;
        else { floor = LOSE_TO[floor]; cout << "You lost. Going to floor " << floor << ".\n"; }
    }
    cout << "\nYou board the helicopter. FREEDOM!\n";
}
