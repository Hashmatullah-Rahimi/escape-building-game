"""Optional extra: a small CNN (convolutional neural network) with PyTorch.
The game itself does not need a CNN. This example trains a CNN to read handwritten
digits, which you could use for a later floor (for example "draw the door code").
Install:  pip install torch torchvision
Run:      python3 cnn_example.py
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms


class SmallCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)    # 28x28 -> 28x28
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.fc1 = nn.Linear(32 * 7 * 7, 64)
        self.fc2 = nn.Linear(64, 10)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)      # 28 -> 14
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)      # 14 -> 7
        x = x.flatten(1)
        return self.fc2(F.relu(self.fc1(x)))


def main():
    tf = transforms.ToTensor()
    train = torch.utils.data.DataLoader(datasets.MNIST(".", train=True, download=True, transform=tf), batch_size=64, shuffle=True)
    test = torch.utils.data.DataLoader(datasets.MNIST(".", train=False, download=True, transform=tf), batch_size=256)
    model = SmallCNN()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    for epoch in range(2):
        model.train()
        for x, y in train:
            opt.zero_grad()
            F.cross_entropy(model(x), y).backward()
            opt.step()
        model.eval()
        ok = 0
        with torch.no_grad():
            for x, y in test:
                ok += (model(x).argmax(1) == y).sum().item()
        print(f"epoch {epoch + 1}: test accuracy {ok / len(test.dataset):.3f}")
    torch.save(model.state_dict(), "cnn_digits.pt")


if __name__ == "__main__":
    main()
