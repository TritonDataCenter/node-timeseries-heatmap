/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

sched:::on-cpu
{
	self->on = timestamp;
}

sched:::off-cpu
/self->on/
{
	this->us = (timestamp - self->on) / 1000;
	@ = lquantize(this->us, 0, 100000, 100);
	@decomp[execname] = lquantize(this->us, 0, 100000, 100);
}
