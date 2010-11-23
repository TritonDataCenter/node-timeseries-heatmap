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
