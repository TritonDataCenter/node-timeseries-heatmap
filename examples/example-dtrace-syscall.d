syscall:::entry
{
	self->in = vtimestamp;
}

syscall:::return
/self->in/
{
	this->ns = vtimestamp - self->in;
	@ = lquantize(this->ns, 0, 100000, 100);
	@decomp[probefunc] = lquantize(this->ns, 0, 100000, 100);
}
