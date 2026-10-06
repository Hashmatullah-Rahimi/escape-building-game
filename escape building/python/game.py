"""Five Floors Out - text version in Python.
Run:  python3 game.py
Rules: lose on floor 1 -> stay on 1. Lose on floors 2-4 -> go one floor down.
Lose on floor 5 -> back to floor 1.
"""
import random
import time

LOSE_TO = {1: 1, 2: 1, 3: 2, 4: 3, 5: 1}


def ask(prompt):
    return input(prompt).strip().lower()


# ---------- Floor 1: Fire and fire ----------
safe_pit = random.randint(1, 3)


def floor1():
    global safe_pit
    print("\nFLOOR 1 - FIND YOUR WAY\nThree fire pits: 1, 2, 3. One hides a stone. Jump!")
    while True:
        c = ask("Which pit? (1/2/3): ")
        if c in ("1", "2", "3"):
            break
    if int(c) == safe_pit:
        print("You land on cold stone. Stairs up!")
        return True
    print("The fire burns you!")
    safe_pit = random.choice([p for p in (1, 2, 3) if p != safe_pit])  # safe pit moves
    return False


# ---------- Floor 2: The bridge ----------
def floor2():
    print("\nFLOOR 2 - THE BRIDGE\nWalk (w) or jump (j). '_' is a gap. Walking into a gap = you fall.")
    bridge = "...._..._...._...._..."   # '.' plank, '_' gap
    pos = 0
    while pos < len(bridge) - 1:
        print("Bridge:", bridge[:pos] + "P" + bridge[pos + 1:])
        move = ask("w = walk, j = jump: ")
        if move == "j":
            pos += 2 if bridge[pos + 1] == "_" else 1   # a jump clears a one-tile gap
            if bridge[pos] == "_":
                print("The gap was too wide! You fall.")
                return False
        else:
            pos += 1
            if bridge[pos] == "_":
                print("You stepped into a gap and fell!")
                return False
    print("You crossed the bridge!")
    return True


# ---------- Floor 3: Maze ----------
def make_maze(cw=6, ch=4):
    cols, rows = 2 * cw + 1, 2 * ch + 1
    grid = [["#"] * cols for _ in range(rows)]
    seen = {(0, 0)}
    stack = [(0, 0)]
    grid[1][1] = " "
    while stack:
        x, y = stack[-1]
        nbs = [(x + dx, y + dy, dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
               if 0 <= x + dx < cw and 0 <= y + dy < ch and (x + dx, y + dy) not in seen]
        if not nbs:
            stack.pop()
            continue
        nx, ny, dx, dy = random.choice(nbs)
        grid[2 * y + 1 + dy][2 * x + 1 + dx] = " "
        grid[2 * ny + 1][2 * nx + 1] = " "
        seen.add((nx, ny))
        stack.append((nx, ny))
    return grid, cols, rows


def floor3():
    print("\nFLOOR 3 - FIND THE RIGHT PATH\nMove with w/a/s/d. P = you, E = exit. You cannot cross walls.")
    grid, cols, rows = make_maze()
    px, py = 1, 1
    ex, ey = cols - 2, rows - 2
    while (px, py) != (ex, ey):
        for y in range(rows):
            line = ""
            for x in range(cols):
                line += "P" if (x, y) == (px, py) else "E" if (x, y) == (ex, ey) else grid[y][x]
            print(line)
        d = {"w": (0, -1), "s": (0, 1), "a": (-1, 0), "d": (1, 0)}.get(ask("Move (w/a/s/d): "))
        if d and grid[py + d[1]][px + d[0]] == " ":
            px, py = px + d[0], py + d[1]
        else:
            print("Wall! Pick another way.")
    print("You found the exit!")
    return True


# ---------- Floor 4: Quiz ----------
BANK = [
    ("print(7 // 2) shows?", ["3", "3.5", "4", "2"]),
    ("Keyword that defines a function?", ["def", "func", "function", "define"]),
    ("len('hello') is?", ["5", "4", "6", "hello"]),
    ("print(2 ** 3) shows?", ["8", "6", "5", "9"]),
    ("print('py' * 3) shows?", ["pypypy", "py3", "py py py", "Error"]),
    ("Which one is immutable?", ["tuple", "list", "dict", "set"]),
    ("list(range(3)) is?", ["[0, 1, 2]", "[1, 2, 3]", "[0, 1, 2, 3]", "[3]"]),
    ("bool('') is?", ["False", "True", "None", "Error"]),
]   # the FIRST answer in each list is the correct one


def floor4():
    print("\nFLOOR 4 - FIVE QUESTIONS\n4 right = win. 2 wrong = you lose.")
    right = wrong = 0
    for q, answers in random.sample(BANK, 5):
        opts = answers[:]
        random.shuffle(opts)
        print("\n" + q)
        for i, o in enumerate(opts, 1):
            print(f"  {i}) {o}")
        c = ask("Answer (1-4): ")
        if c.isdigit() and 1 <= int(c) <= 4 and opts[int(c) - 1] == answers[0]:
            right += 1
            print("Correct!")
        else:
            wrong += 1
            print("Wrong! The answer was:", answers[0])
        if right >= 4:
            return True
        if wrong >= 2:
            return False
    return right >= 4


# ---------- Floor 5: Build the door ----------
PUZZLE = [
    "def unlock(pin):",
    "    if pin == 4821:",
    '        return "OPEN"',
    '    return "LOCKED"',
    "result = unlock(4821)",
    "print(result)",
]


def floor5():
    print("\nFLOOR 5 - BUILD THE DOOR\nPut the lines in the right order within 120 seconds.")
    order = list(range(len(PUZZLE)))
    while order == sorted(order):
        random.shuffle(order)
    for n, i in enumerate(order, 1):
        print(f"  {n}) {PUZZLE[i]}")
    start = time.time()
    while True:
        a = ask("Type the line numbers in order, e.g. 3 1 2 4 5 6: ").split()
        if time.time() - start > 120:
            print("Time is up!")
            return False
        if len(a) == len(PUZZLE) and all(x.isdigit() and 1 <= int(x) <= len(PUZZLE) for x in a):
            if [order[int(x) - 1] for x in a] == list(range(len(PUZZLE))):
                print("The door opens! The helicopter is waiting...")
                return True
            print("The program does not run correctly. Try again.")
        else:
            print("Give all", len(PUZZLE), "numbers.")


FLOORS = {1: floor1, 2: floor2, 3: floor3, 4: floor4, 5: floor5}


def main():
    floor = 1
    while floor <= 5:
        print(f"\n=== You are on floor {floor} ===")
        if FLOORS[floor]():
            floor += 1
        else:
            floor = LOSE_TO[floor]
            print(f"You lost. Going to floor {floor}.")
    print("\nYou board the helicopter. FREEDOM!")


if __name__ == "__main__":
    main()
