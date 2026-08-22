CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -O2
LDFLAGS ?=
PYTHON ?= python3

.PHONY: all clean check

all: mlsu_ct_cli test_mlsu_ct

mlsu_ct.o: mlsu_ct.c mlsu_ct.h
	$(CC) $(CFLAGS) -c mlsu_ct.c -o $@

mlsu_ct_cli: mlsu_ct_cli.c mlsu_ct.o
	$(CC) $(CFLAGS) mlsu_ct_cli.c mlsu_ct.o -o $@ $(LDFLAGS)

test_mlsu_ct: test_mlsu_ct.c mlsu_ct.o
	$(CC) $(CFLAGS) test_mlsu_ct.c mlsu_ct.o -o $@ $(LDFLAGS)

check: all
	./test_mlsu_ct
	python3 crosscheck.py

clean:
	rm -f mlsu_ct.o mlsu_ct_cli test_mlsu_ct
